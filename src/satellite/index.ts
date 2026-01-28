import {
  type AssertDeleteAsset,
  type AssertDeleteDoc,
  type AssertSetDoc,
  type AssertUploadAsset,
  defineAssert,
  defineHook,
  type OnDeleteAsset,
  type OnDeleteDoc,
  type OnDeleteFilteredAssets,
  type OnDeleteFilteredDocs,
  type OnDeleteManyAssets,
  type OnDeleteManyDocs,
  type OnSetDoc,
  type OnSetManyDocs,
  type OnUploadAsset
} from '@junobuild/functions';

import {
  decodeDocData,
  encodeDocData,
  setDocStore,
} from '@junobuild/functions/sdk';

import { Principal } from '@dfinity/principal';

// Import webhook handlers
export { paddleWebhook } from './paddle-webhook';

// Import validation utilities
import {
  isPlatformAdmin,
  getEffectivePlanLimits,
  getSubscriptionStatus,
  validateDailyQuota,
  validateAndIncrementBulkExport,
  validateAndIncrementDownload,
  validateTemplateCount,
} from './utils/subscription-validator';
import { checkRateLimit } from './utils/rate-limiter';
import {
  logQuotaViolation,
  logRateLimitHit,
  logUnauthorizedAccess,
  recordSecurityEvent,
} from './utils/monitoring';
import {
  checkQuotaViolationThreshold,
  checkRateLimitThreshold,
} from './utils/admin-notifier';

// All the available hooks and assertions for your Datastore and Storage are scaffolded by default in this module.
// However, if you don’t have to implement all of them, for example to improve readability or reduce unnecessary logic,
// you can selectively delete the features you do not need.

export const onSetDoc = defineHook<OnSetDoc>({
  collections: ['download_requests'],
  run: async (context) => {
    const { caller, data } = context;
    const userId = Principal.from(caller).toText();
    
    console.log('🔵 [DOWNLOAD_REQUEST] onSetDoc hook triggered:', { userId, key: data.key });
    
    // Decode the document data using Juno's SDK
    const requestData = decodeDocData<any>(context.data.data.after.data);
    
    console.log('🔵 [DOWNLOAD_REQUEST] Decoded request data:', {
      status: requestData.status,
      requestType: requestData.requestType,
      templateIds: requestData.templateIds
    });
    
    // Only process pending requests
    if (requestData?.status !== 'pending') {
      console.log('🔵 [DOWNLOAD_REQUEST] Skipping - not pending. Status:', requestData?.status);
      return;
    }
    
    const requestType = requestData.requestType as 'download' | 'export';
    const templateIds = requestData.templateIds as string[];
    
    console.log('🔵 [DOWNLOAD_REQUEST] Processing pending request:', { requestType, templateIds, userId });

    // Platform admins bypass all validation
    const isAdmin = await isPlatformAdmin(userId);
    console.log('🔵 [DOWNLOAD_REQUEST] Admin check:', { isAdmin });
    
    if (isAdmin) {
      console.log('✅ [DOWNLOAD_REQUEST] Admin approved request');
      await setDocStore({
        caller,
        collection: 'download_requests',
        key: data.key,
        doc: {
          data: encodeDocData({
            ...requestData,
            status: 'approved',
            approvedTemplateIds: templateIds,
          }),
          version: context.data.data.after.version,
        },
      });
      return;
    }

    let rollbackFunction: (() => Promise<void>) | undefined;

    try {
      // 1. Check subscription status first (before touching quota)
      console.log('🔵 [DOWNLOAD_REQUEST] Checking subscription status...');
      const subscriptionStatus = await getSubscriptionStatus(userId);
      console.log('🔵 [DOWNLOAD_REQUEST] Subscription status:', subscriptionStatus);
      
      if (!subscriptionStatus.isActive) {
        console.log('❌ [DOWNLOAD_REQUEST] Rejected - subscription expired');
        await setDocStore({
          caller,
          collection: 'download_requests',
          key: data.key,
          doc: {
            data: encodeDocData({
              ...requestData,
              status: 'rejected',
              error: {
                code: 'subscription_expired',
                message: 'Your subscription has expired. Please renew to continue.',
              },
            }),
            version: context.data.data.after.version,
          },
        });
        await recordSecurityEvent({
          eventType: 'unauthorized_access',
          severity: 'warning',
          userId,
          message: 'Attempted download with expired subscription',
          timestamp: Date.now(),
        });
        return;
      }

      // 2. Check rate limits
      console.log('🔵 [DOWNLOAD_REQUEST] Checking rate limits...');
      const rateLimitCheck = await checkRateLimit(
        userId,
        requestType === 'export' ? 'export' : 'download',
        caller
      );
      console.log('🔵 [DOWNLOAD_REQUEST] Rate limit check:', rateLimitCheck);

      if (!rateLimitCheck.allowed) {
        console.log('❌ [DOWNLOAD_REQUEST] Rejected - rate limit exceeded');
        await setDocStore({
          caller,
          collection: 'download_requests',
          key: data.key,
          doc: {
            data: encodeDocData({
              ...requestData,
              status: 'rejected',
              error: {
                code: 'rate_limit',
                message: `Rate limit exceeded. Please try again in ${rateLimitCheck.retryAfterSeconds} seconds.`,
                retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
              },
            }),
            version: context.data.data.after.version,
          },
        });
        await logRateLimitHit(
          userId,
          requestType === 'export' ? 'export' : 'download',
          {
            limit: rateLimitCheck.remaining || 0,
            retryAfter: rateLimitCheck.retryAfterSeconds || 60
          }
        );
        await checkRateLimitThreshold(userId, requestType === 'export' ? 'export' : 'download');
        return;
      }

      // 3. Validate and increment quota with rollback support
      console.log('🔵 [DOWNLOAD_REQUEST] Validating quota...');
      let validationResult;
      
      if (requestType === 'export') {
        validationResult = await validateAndIncrementBulkExport(userId, caller);
      } else {
        validationResult = await validateAndIncrementDownload(userId, caller);
      }
      console.log('🔵 [DOWNLOAD_REQUEST] Quota validation result:', validationResult);

      if (!validationResult.success) {
        console.log('❌ [DOWNLOAD_REQUEST] Rejected - quota exceeded');
        await setDocStore({
          caller,
          collection: 'download_requests',
          key: data.key,
          doc: {
            data: encodeDocData({
              ...requestData,
              status: 'rejected',
              error: validationResult.error,
            }),
            version: context.data.data.after.version,
          },
        });

        if (validationResult.error?.code === 'quota_exceeded') {
          await logQuotaViolation(userId, requestType === 'export' ? 'monthly' : 'daily', {
            limit: validationResult.error.limit || 0,
            current: validationResult.error.used || 0,
            planId: (await getEffectivePlanLimits(userId)).planId,
          });
          await checkQuotaViolationThreshold(userId, (await getEffectivePlanLimits(userId)).planId);
        }
        return;
      }

      rollbackFunction = validationResult.rollback;

      // 4. All validations passed - approve the request
      console.log('✅ [DOWNLOAD_REQUEST] All validations passed - approving request');
      await setDocStore({
        caller,
        collection: 'download_requests',
        key: data.key,
        doc: {
          data: encodeDocData({
            ...requestData,
            status: 'approved',
            approvedTemplateIds: templateIds,
          }),
          version: context.data.data.after.version,
        },
      });

    } catch (error: any) {
      console.error('❌ [DOWNLOAD_REQUEST] Error during validation:', error);
      
      if (rollbackFunction) {
        console.log('🔄 [DOWNLOAD_REQUEST] Executing rollback...');
        try {
          await rollbackFunction();
          console.log('✅ [DOWNLOAD_REQUEST] Rollback successful');
        } catch (rollbackError) {
          console.error('❌ [DOWNLOAD_REQUEST] Rollback failed:', rollbackError);
        }
      }

      console.log('❌ [DOWNLOAD_REQUEST] Rejected - server error');
      await setDocStore({
        caller,
        collection: 'download_requests',
        key: data.key,
        doc: {
          data: encodeDocData({
            ...requestData,
            status: 'rejected',
            error: {
              code: 'server_error',
              message: error.message || 'Validation failed',
            },
          }),
          version: context.data.data.after.version,
        },
      });

      await recordSecurityEvent({
        eventType: 'unauthorized_access',
        severity: 'warning',
        userId,
        message: `Download request validation error: ${error.message}`,
        timestamp: Date.now(),
      });
    }

    console.log('🔵 [DOWNLOAD_REQUEST] Hook completed');
  }
});

export const onSetManyDocs = defineHook<OnSetManyDocs>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteDoc = defineHook<OnDeleteDoc>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteManyDocs = defineHook<OnDeleteManyDocs>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteFilteredDocs = defineHook<OnDeleteFilteredDocs>({
  collections: [],
  run: async (_context) => {}
});

export const onUploadAsset = defineHook<OnUploadAsset>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteAsset = defineHook<OnDeleteAsset>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteManyAssets = defineHook<OnDeleteManyAssets>({
  collections: [],
  run: async (_context) => {}
});

export const onDeleteFilteredAssets = defineHook<OnDeleteFilteredAssets>({
  collections: [],
  run: async (_context) => {}
});

export const assertSetDoc = defineAssert<AssertSetDoc>({
  collections: ['*'], // Apply to all collections
  assert: async (context) => {
    const { caller, data } = context;
    const userId = Principal.from(caller).toText();
    const collection = data.collection;

    // Protected collections that only admins/satellite can write to
    const protectedCollections = [
      'subscriptions',
      'usage',
      'subscription_overrides',
      'export_usage',
      'rate_limits',
      'security_events',
      'admin_notifications',
    ];

    // Check if trying to write to protected collection
    if (protectedCollections.includes(collection)) {
      const isAdmin = await isPlatformAdmin(userId);
      
      if (!isAdmin) {
        await logUnauthorizedAccess(
          userId,
          collection,
          'Attempted to write to protected collection'
        );
        throw new Error(`Access denied: ${collection} is a protected collection`);
      }
    }

    // Cleanup orphaned download requests (>5 minutes old)
    if (collection === 'download_requests') {
      console.log('🔵 [DOWNLOAD_REQUEST] assertSetDoc - allowing request to be saved');
      
      try {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const { listDocs: listDocsStore, deleteDoc: deleteDocStore } = await import('@junobuild/core');
        
        const orphanedRequests = await listDocsStore({
          collection: 'download_requests',
          filter: {
            owner: userId,
          },
        });

        for (const req of orphanedRequests.items) {
          const createdAt = (req.data as any)?.createdAt || 0;
          if (createdAt < fiveMinutesAgo) {
            try {
              await deleteDocStore({
                collection: 'download_requests',
                doc: req,
              });
              console.log('🧹 [DOWNLOAD_REQUEST] Cleaned up orphaned request:', req.key);
            } catch (deleteError) {
              console.error('Failed to cleanup orphaned request:', deleteError);
            }
          }
        }
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      
      // Allow the request to be saved as-is - the onSetDoc hook will process it
      return;
    }

    // Validate usage updates (document processing quotas)
    if (collection === 'usage') {
      // Check subscription status
      const subscriptionStatus = await getSubscriptionStatus(userId);
      if (!subscriptionStatus.isActive) {
        await logUnauthorizedAccess(
          userId,
          'usage_increment',
          'Attempted to increment usage with expired subscription'
        );
        throw new Error('Subscription expired');
      }

      // Validate daily quota
      const dailyQuotaCheck = await validateDailyQuota(userId);
      if (!dailyQuotaCheck.valid) {
        const limits = await getEffectivePlanLimits(userId);
        await logQuotaViolation(userId, 'daily', {
          limit: dailyQuotaCheck.limit!,
          current: dailyQuotaCheck.used!,
          planId: limits.planId,
        });
        await checkQuotaViolationThreshold(userId, limits.planId);
        throw new Error(dailyQuotaCheck.message);
      }
    }
  }
});

export const assertDeleteDoc = defineAssert<AssertDeleteDoc>({
  collections: [],
  assert: (_context) => {}
});

export const assertUploadAsset = defineAssert<AssertUploadAsset>({
  collections: [],
  assert: async (context) => {
    const { caller } = context;
    const userId = Principal.from(caller).toText();

    // Platform admins bypass all limits
    const isAdmin = await isPlatformAdmin(userId);
    if (isAdmin) {
      return;
    }

    // Check subscription status
    const subscriptionStatus = await getSubscriptionStatus(userId);
    if (!subscriptionStatus.isActive) {
      throw new Error('Subscription expired or inactive');
    }

    // Validate template count limit
    const templateCheck = await validateTemplateCount(userId);
    if (!templateCheck.valid) {
      throw new Error(templateCheck.message || 'Template limit reached');
    }
  }
});

export const assertDeleteAsset = defineAssert<AssertDeleteAsset>({
  collections: [],
  assert: (_context) => {}
});
