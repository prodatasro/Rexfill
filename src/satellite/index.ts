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
  listDocsStore
} from '@junobuild/functions/sdk';
import { id } from '@junobuild/functions/ic-cdk';

import { Principal } from '@dfinity/principal';

// Import Paddle API functions
import {
  getPaddleConfig,
  fetchPaddleSubscription,
  fetchPaddleSubscriptionByUserId,
  updateSubscription as updateSubscriptionFromPaddle,
  setProxyConfig,
} from './paddle-poller';

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
  collections: ['download_requests', 'subscriptions', 'paddle_sync_triggers', 'canister_config_triggers'],
  run: async (context) => {
    const { caller, data } = context;
    const userId = Principal.from(caller).toText();
    const collection = context.data.collection;
    
    // ========================================
    // CANISTER CONFIG TRIGGER
    // ========================================
    if (collection === 'canister_config_triggers') {
      console.log('⚙️ [CANISTER_CONFIG] Configuration trigger received:', { userId, triggerId: data.key });
      
      try {
        // Read secrets from datastore
        const secrets = await listDocsStore({
          caller: id(),
          collection: 'secrets',
          params: {}
        });
        
        // Find required secrets and decode their data
        const prodApiKeyDoc = secrets?.items.find(([key]: [string, any]) => key === 'PADDLE_API_KEY_PROD')?.[1];
        const devApiKeyDoc = secrets?.items.find(([key]: [string, any]) => key === 'PADDLE_API_KEY_DEV')?.[1];
        const prodWebhookSecretDoc = secrets?.items.find(([key]: [string, any]) => key === 'PADDLE_WEBHOOK_SECRET_PROD')?.[1];
        const devWebhookSecretDoc = secrets?.items.find(([key]: [string, any]) => key === 'PADDLE_WEBHOOK_SECRET_DEV')?.[1];
        
        const prodApiKey = prodApiKeyDoc ? decodeDocData<{ value: string }>(prodApiKeyDoc.data) : null;
        const devApiKey = devApiKeyDoc ? decodeDocData<{ value: string }>(devApiKeyDoc.data) : null;
        const prodWebhookSecret = prodWebhookSecretDoc ? decodeDocData<{ value: string }>(prodWebhookSecretDoc.data) : null;
        const devWebhookSecret = devWebhookSecretDoc ? decodeDocData<{ value: string }>(devWebhookSecretDoc.data) : null;

        // Determine environment based on whether prod key exists
        const isProd = !!prodApiKey?.value;
        const apiKeyProd = prodApiKey?.value || '';
        const apiKeySandbox = devApiKey?.value || '';
        const webhookSecret = isProd ? (prodWebhookSecret?.value || '') : (devWebhookSecret?.value || '');
        const environment = isProd ? { production: null } : { sandbox: null };
        
        if (!apiKeySandbox && !apiKeyProd) {
          console.error('⚙️ [CANISTER_CONFIG] At least one Paddle API key is required');
          return;
        }
        
        console.log(`⚙️ [CANISTER_CONFIG] Configuring canister with environment: ${isProd ? 'production' : 'sandbox'}`);
        
        // Call RexfillProxy canister's setConfig method
        const result = await setProxyConfig(
          apiKeyProd,
          apiKeySandbox,
          webhookSecret,
          environment
        );
        
        if ('Err' in result) {
          console.error('⚙️ [CANISTER_CONFIG] Failed to configure canister:', result.Err);
          
          await recordSecurityEvent({
            eventType: 'paddle_api_error',
            severity: 'warning',
            userId,
            endpoint: 'canister_config_trigger',
            message: `Failed to configure canister: ${result.Err}`,
            timestamp: Date.now(),
          });
          return;
        }
        
        console.log('✅ [CANISTER_CONFIG] Canister configured successfully');
        
        // Log configuration event
        await recordSecurityEvent({
          eventType: 'paddle_api_access',
          severity: 'info',
          userId,
          endpoint: 'canister_config_trigger',
          message: `RexfillProxy canister configured (${isProd ? 'production' : 'sandbox'})`,
          metadata: {
            triggerId: data.key,
            hasProdKey: !!apiKeyProd,
            hasDevKey: !!apiKeySandbox,
            hasProdWebhook: !!prodWebhookSecret?.value,
            hasDevWebhook: !!devWebhookSecret?.value,
          },
          timestamp: Date.now(),
        });
        
      } catch (error: any) {
        console.error('❌ [CANISTER_CONFIG] Error configuring canister:', error);
        
        await recordSecurityEvent({
          eventType: 'paddle_api_error',
          severity: 'warning',
          userId,
          endpoint: 'canister_config_trigger',
          message: `Failed to configure canister: ${error.message}`,
          timestamp: Date.now(),
        });
      }
      
      return; // Exit early, don't process other hooks
    }
    
    // ========================================
    // PADDLE SYNC TRIGGER (Event-Driven Pattern)
    // ========================================
    if (collection === 'paddle_sync_triggers') {
      console.log('🟣 [PADDLE_SYNC_TRIGGER] Sync trigger received:', { userId, triggerId: data.key });
      
      const triggerData = decodeDocData<any>(context.data.data.after.data);
      const targetUserId = triggerData.userId || userId;
      
      console.log('🟣 [PADDLE_SYNC_TRIGGER] Target user:', targetUserId);
      
      try {
        // Get Paddle API configuration using canister identity (not user principal)
        const config = await getPaddleConfig();
        
        if (!config) {
          console.error('🟣 [PADDLE_SYNC_TRIGGER] No Paddle API key configured');
          return;
        }
        
        console.log(`🟣 [PADDLE_SYNC_TRIGGER] Using Paddle API (${config.environment})`);
        
        // Query Paddle for user's subscription
        let paddleData = null;
        
        // If we have a subscription ID in the trigger, try direct lookup first
        if (triggerData.subscriptionId) {
          console.log('🟣 [PADDLE_SYNC_TRIGGER] Attempting direct lookup:', triggerData.subscriptionId);
          paddleData = await fetchPaddleSubscription(triggerData.subscriptionId);
        }
        
        // Fall back to userId-based query
        if (!paddleData) {
          console.log('🟣 [PADDLE_SYNC_TRIGGER] Querying by userId:', targetUserId);
          paddleData = await fetchPaddleSubscriptionByUserId(targetUserId);
        }
        
        if (!paddleData) {
          console.log('🟣 [PADDLE_SYNC_TRIGGER] No subscription found in Paddle');
          return;
        }
        
        console.log('🟣 [PADDLE_SYNC_TRIGGER] Found subscription:', paddleData.id);
        
        // Update the subscription collection
        await updateSubscriptionFromPaddle(targetUserId, targetUserId, paddleData);
        
        console.log('✅ [PADDLE_SYNC_TRIGGER] Subscription synced successfully');
        
        // Log successful sync
        await recordSecurityEvent({
          eventType: 'paddle_api_access',
          severity: 'info',
          userId: targetUserId,
          endpoint: 'paddle_sync_trigger',
          message: `Subscription synced from Paddle via trigger (${config.environment})`,
          metadata: {
            triggerId: data.key,
            subscriptionId: paddleData.id,
            status: paddleData.status,
          },
          timestamp: Date.now(),
        });
        
      } catch (error: any) {
        console.error('❌ [PADDLE_SYNC_TRIGGER] Error syncing subscription:', error);
        
        await recordSecurityEvent({
          eventType: 'paddle_api_error',
          severity: 'warning',
          userId: targetUserId,
          endpoint: 'paddle_sync_trigger',
          message: `Failed to sync subscription: ${error.message}`,
          timestamp: Date.now(),
        });
      }
      
      return; // Exit early, don't process other hooks
    }
    
    // ========================================
    // PADDLE SUBSCRIPTION AUTO-REFRESH (Legacy)
    // ========================================
    if (collection === 'subscriptions') {
      console.log('🟣 [PADDLE_SYNC] onSetDoc hook triggered for subscriptions:', { userId, key: data.key });
      
      const subData = decodeDocData<any>(context.data.data.after.data);
      console.log('🟣 [PADDLE_SYNC] Subscription data:', {
        paddleSubscriptionId: subData.paddleSubscriptionId,
        status: subData.status,
        needsRefresh: subData.needsRefresh,
      });
      
      // Only auto-refresh if refresh is needed
      if (subData.needsRefresh === true) {
        console.log('🟣 [PADDLE_SYNC] Auto-refreshing subscription from Paddle API...');
        
        try {
          // Get Paddle API configuration using canister identity (not user principal)
          const config = await getPaddleConfig();
          
          if (!config) {
            console.error('🟣 [PADDLE_SYNC] No Paddle API key configured - skipping refresh');
            
            // Update document to clear refresh flag and note the error
            await setDocStore({
              caller,
              collection: 'subscriptions',
              key: data.key,
              doc: {
                data: encodeDocData({
                  ...subData,
                  needsRefresh: false,
                  lastSyncError: 'No Paddle API key configured',
                  lastSyncAttempt: Date.now(),
                }),
                version: context.data.data.after.version,
              },
            });
            
            await recordSecurityEvent({
              eventType: 'paddle_api_error',
              severity: 'critical',
              userId,
              endpoint: 'onSetDoc_subscription_refresh',
              message: 'Attempted to refresh subscription without Paddle API key',
              timestamp: Date.now(),
            });
            return;
          }
          
          console.log(`🟣 [PADDLE_SYNC] Using Paddle API (${config.environment})`);
          
          // Fetch subscription from Paddle
          // Try direct lookup first if we have the ID, otherwise query by userId
          let paddleData = null;
          
          if (subData.paddleSubscriptionId) {
            console.log('🟣 [PADDLE_SYNC] Attempting direct subscription lookup:', subData.paddleSubscriptionId);
            paddleData = await fetchPaddleSubscription(subData.paddleSubscriptionId);
          }
          
          if (!paddleData) {
            console.log('🟣 [PADDLE_SYNC] Direct lookup failed, querying by userId:', userId);
            paddleData = await fetchPaddleSubscriptionByUserId(userId);
          }
          
          if (!paddleData) {
            console.log('🟣 [PADDLE_SYNC] No subscription found in Paddle (may not be created yet)');
            
            // Update document to clear refresh flag
            await setDocStore({
              caller,
              collection: 'subscriptions',
              key: data.key,
              doc: {
                data: encodeDocData({
                  ...subData,
                  needsRefresh: false,
                  lastSyncError: 'Subscription not found in Paddle API',
                  lastSyncAttempt: Date.now(),
                }),
                version: context.data.data.after.version,
              },
            });
            return;
          }
          
          console.log('🟣 [PADDLE_SYNC] Successfully fetched from Paddle:', {
            status: paddleData.status,
            customerId: paddleData.customer_id,
          });
          
          // Update the subscription with fresh Paddle data
          await updateSubscriptionFromPaddle(userId, data.key, paddleData);
          
          console.log('✅ [PADDLE_SYNC] Subscription successfully synced from Paddle');
          
          // Log successful sync
          await recordSecurityEvent({
            eventType: 'paddle_api_access',
            severity: 'info',
            userId,
            endpoint: 'onSetDoc_subscription_refresh',
            message: `Subscription auto-refreshed from Paddle (${config.environment})`,
            metadata: {
              subscriptionId: subData.paddleSubscriptionId,
              status: paddleData.status,
            },
            timestamp: Date.now(),
          });
          
        } catch (error: any) {
          console.error('❌ [PADDLE_SYNC] Error refreshing subscription:', error);
          
          // Update document to clear refresh flag and note the error
          await setDocStore({
            caller,
            collection: 'subscriptions',
            key: data.key,
            doc: {
              data: encodeDocData({
                ...subData,
                needsRefresh: false,
                lastSyncError: error.message || 'Unknown error',
                lastSyncAttempt: Date.now(),
              }),
              version: context.data.data.after.version,
            },
          });
          
          await recordSecurityEvent({
            eventType: 'paddle_api_error',
            severity: 'warning',
            userId,
            endpoint: 'onSetDoc_subscription_refresh',
            message: `Subscription refresh failed: ${error.message}`,
            metadata: {
              subscriptionId: subData.paddleSubscriptionId,
              error: error.message,
            },
            timestamp: Date.now(),
          });
        }
      } else {
        console.log('🟣 [PADDLE_SYNC] Skipping refresh - conditions not met');
      }
      
      return; // Exit after handling subscription
    }
    
    // ========================================
    // DOWNLOAD REQUEST VALIDATION
    // ========================================
    if (collection === 'download_requests') {
    
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
    } // End download_requests handling
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
