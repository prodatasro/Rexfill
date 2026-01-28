/**
 * Subscription Validator Utility
 * 
 * Server-side validation for subscription tiers, quotas, and limits.
 * Enforces business rules on the backend to prevent client-side bypass.
 * 
 * Key Features:
 * - Loads user subscriptions from Juno datastore
 * - Checks admin overrides for custom quotas
 * - Resolves effective plan limits (admin override > paid > free)
 * - Validates file size, template count, and usage quotas
 * - Enforces immediate cutoff for expired subscriptions
 */

import { getDocStore, listDocsStore, setDocStore } from '@junobuild/functions/sdk';
import { id } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData } from '@junobuild/functions/sdk';
import { Principal } from '@dfinity/principal';

export interface EffectivePlanLimits {
  documentsPerDay: number;
  documentsPerMonth: number;
  bulkExportsPerDay: number;
  maxTemplates: number;
  maxFileSize: number; // in MB
  batchProcessing: boolean;
  prioritySupport: boolean;
  planId: string;
  source: 'admin_override' | 'subscription' | 'free_tier';
}

export interface SubscriptionStatus {
  isActive: boolean;
  isExpired: boolean;
  expiresAt?: number;
  gracePeriodEndsAt?: number;
}

export interface AdminOverride {
  expiresAt?: number;
  overrideQuotas?: {
    documentsPerDay?: number;
    documentsPerMonth?: number;
    bulkExportsPerDay?: number;
    maxTemplates?: number;
    maxFileSize?: number;
  };
}

/**
 * Load user's subscription from datastore
 */
export async function getUserSubscription(userId: string): Promise<any | null> {
  try {
    const doc = await getDocStore({
      caller: id(),
      collection: 'subscriptions',
      key: userId,
    });
    return doc ? decodeDocData(doc.data) : null;
  } catch (error) {
    console.error('Failed to load subscription:', error);
    return null;
  }
}

/**
 * Check if user has an admin override
 */
export async function getAdminOverride(userId: string): Promise<AdminOverride | null> {
  try {
    const doc = await getDocStore({
      caller: id(),
      collection: 'subscription_overrides',
      key: userId,
    });

    if (!doc) return null;

    const override = decodeDocData(doc.data) as AdminOverride;

    // Check if override has expired
    if (override.expiresAt && override.expiresAt < Date.now()) {
      return null;
    }

    return override;
  } catch (error) {
    console.error('Failed to load admin override:', error);
    return null;
  }
}

/**
 * Resolve effective plan limits with priority: platform admin > admin override > subscription > free tier
 */
export async function getEffectivePlanLimits(userId: string): Promise<EffectivePlanLimits> {
  // Default free tier limits
  const freeTierLimits: EffectivePlanLimits = {
    documentsPerDay: 5,
    documentsPerMonth: 50,
    bulkExportsPerDay: 1,
    maxTemplates: 10,
    maxFileSize: 10,
    batchProcessing: false,
    prioritySupport: false,
    planId: 'free',
    source: 'free_tier',
  };

  // Check if user is platform admin (highest priority - unlimited access)
  const isAdmin = await isPlatformAdmin(userId);
  if (isAdmin) {
    return {
      documentsPerDay: -1,
      documentsPerMonth: -1,
      bulkExportsPerDay: -1,
      maxTemplates: -1,
      maxFileSize: 1000, // Very high limit for admins
      batchProcessing: true,
      prioritySupport: true,
      planId: 'admin',
      source: 'admin_override',
    };
  }

  // Check for admin override (second priority)
  const override = await getAdminOverride(userId);
  if (override?.overrideQuotas) {
    const subscription = await getUserSubscription(userId);
    const basePlan = subscription?.planId || 'free';
    
    return {
      documentsPerDay: override.overrideQuotas.documentsPerDay ?? freeTierLimits.documentsPerDay,
      documentsPerMonth: override.overrideQuotas.documentsPerMonth ?? freeTierLimits.documentsPerMonth,
      bulkExportsPerDay: override.overrideQuotas.bulkExportsPerDay ?? freeTierLimits.bulkExportsPerDay,
      maxTemplates: override.overrideQuotas.maxTemplates ?? freeTierLimits.maxTemplates,
      maxFileSize: override.overrideQuotas.maxFileSize ?? freeTierLimits.maxFileSize,
      batchProcessing: true, // Always enabled for overrides
      prioritySupport: true,
      planId: basePlan,
      source: 'admin_override',
    };
  }

  // Check subscription status
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return freeTierLimits;
  }

  // Map subscription plan to limits
  const planLimits = getPlanLimitsFromPlanId(subscription.planId);
  
  return {
    ...planLimits,
    planId: subscription.planId,
    source: 'subscription',
  };
}

/**
 * Get plan limits from plan ID (matches frontend plans.ts)
 */
function getPlanLimitsFromPlanId(planId: string): Omit<EffectivePlanLimits, 'planId' | 'source'> {
  const plans: Record<string, Omit<EffectivePlanLimits, 'planId' | 'source'>> = {
    free: {
      documentsPerDay: 5,
      documentsPerMonth: 50,
      bulkExportsPerDay: 1,
      maxTemplates: 10,
      maxFileSize: 10,
      batchProcessing: false,
      prioritySupport: false,
    },
    starter: {
      documentsPerDay: 50,
      documentsPerMonth: 500,
      bulkExportsPerDay: 3,
      maxTemplates: 100,
      maxFileSize: 25,
      batchProcessing: true,
      prioritySupport: false,
    },
    professional: {
      documentsPerDay: 200,
      documentsPerMonth: 2000,
      bulkExportsPerDay: 10,
      maxTemplates: 500,
      maxFileSize: 50,
      batchProcessing: true,
      prioritySupport: true,
    },
    enterprise: {
      documentsPerDay: -1,
      documentsPerMonth: -1,
      bulkExportsPerDay: -1,
      maxTemplates: -1,
      maxFileSize: 100,
      batchProcessing: true,
      prioritySupport: true,
    },
    team: {
      documentsPerDay: 250,
      documentsPerMonth: 2500,
      bulkExportsPerDay: 5,
      maxTemplates: 500,
      maxFileSize: 50,
      batchProcessing: true,
      prioritySupport: true,
    },
    business: {
      documentsPerDay: 1000,
      documentsPerMonth: 10000,
      bulkExportsPerDay: 15,
      maxTemplates: 2000,
      maxFileSize: 75,
      batchProcessing: true,
      prioritySupport: true,
    },
    enterprise_org: {
      documentsPerDay: -1,
      documentsPerMonth: -1,
      bulkExportsPerDay: -1,
      maxTemplates: -1,
      maxFileSize: 100,
      batchProcessing: true,
      prioritySupport: true,
    },
  };

  return plans[planId] || plans.free;
}

/**
 * Check subscription status (active, expired, grace period)
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return {
      isActive: true, // Free tier is always active
      isExpired: false,
    };
  }

  const now = Date.now();
  const status = subscription.status;

  // Immediate cutoff for canceled/paused subscriptions
  if (status === 'canceled' || status === 'paused') {
    return {
      isActive: false,
      isExpired: true,
      expiresAt: subscription.currentPeriodEnd,
    };
  }

  // Check if subscription is past due (grace period)
  if (status === 'past_due') {
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours
    const gracePeriodEndsAt = (subscription.lastPaymentAttempt || now) + gracePeriod;
    
    return {
      isActive: now < gracePeriodEndsAt,
      isExpired: now >= gracePeriodEndsAt,
      expiresAt: subscription.currentPeriodEnd,
      gracePeriodEndsAt,
    };
  }

  // Active subscription
  return {
    isActive: status === 'active',
    isExpired: false,
    expiresAt: subscription.currentPeriodEnd,
  };
}

/**
 * Validate file size against plan limits
 */
export async function validateFileSize(userId: string, fileSizeBytes: number): Promise<{ valid: boolean; message?: string; limit?: number }> {
  const limits = await getEffectivePlanLimits(userId);
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  const maxSizeMB = limits.maxFileSize;

  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      message: `File size ${fileSizeMB.toFixed(2)}MB exceeds plan limit of ${maxSizeMB}MB`,
      limit: maxSizeMB,
    };
  }

  return { valid: true, limit: maxSizeMB };
}

/**
 * Validate template count against plan limits
 */
export async function validateTemplateCount(userId: string): Promise<{ valid: boolean; message?: string; current?: number; limit?: number }> {
  const limits = await getEffectivePlanLimits(userId);
  
  // If unlimited, always valid
  if (limits.maxTemplates === -1) {
    return { valid: true, current: 0, limit: -1 };
  }

  // Count user's current templates
  try {
    // Get all templates
    const { items } = await listDocsStore({
      caller: id(),
      collection: 'templates_meta',
      params: {}
    });

    // Get all admins to check if this user is an admin
    const { items: admins } = await listDocsStore({
      caller: id(),
      collection: 'platform_admins',
      params: {}
    });
    const adminIds = new Set(admins.map(([key]) => key));

    // Platform admins have unlimited templates
    if (adminIds.has(userId)) {
      return { valid: true, current: 0, limit: -1 };
    }

    // Count only templates owned by this user
    // In satellite context, filter by key matching user's principal
    const currentCount = items.filter(([_key, doc]) => {
      // Templates are stored with owner info in the key or we check the owner principal
      // Since owner is a Principal type, we need to convert and compare
      try {
        const ownerPrincipal = Principal.from(doc.owner).toText();
        return ownerPrincipal === userId;
      } catch {
        // If owner parsing fails, skip this template
        return false;
      }
    }).length;

    if (currentCount >= limits.maxTemplates) {
      return {
        valid: false,
        message: `Template limit reached. You have ${currentCount}/${limits.maxTemplates} templates.`,
        current: currentCount,
        limit: limits.maxTemplates,
      };
    }

    return { valid: true, current: currentCount, limit: limits.maxTemplates };
  } catch (error) {
    console.error('Failed to count templates:', error);
    // Fail open if we can't count (better than blocking legitimate users)
    return { valid: true };
  }
}

/**
 * Validate daily document processing quota
 */
export async function validateDailyQuota(userId: string): Promise<{ valid: boolean; message?: string; used?: number; limit?: number }> {
  const limits = await getEffectivePlanLimits(userId);
  
  // If unlimited, always valid
  if (limits.documentsPerDay === -1) {
    return { valid: true, used: 0, limit: -1 };
  }

  // Get today's usage
  const today = new Date().toISOString().split('T')[0];
  try {
    const usageDoc = await getDocStore({
      caller: id(),
      collection: 'usage',
      key: `${userId}_${today}`,
    });

    const documentsToday = usageDoc ? (decodeDocData(usageDoc.data) as any)?.documentsProcessed || 0 : 0;

    if (documentsToday >= limits.documentsPerDay) {
      return {
        valid: false,
        message: `Daily limit reached. You have processed ${documentsToday}/${limits.documentsPerDay} documents today.`,
        used: documentsToday,
        limit: limits.documentsPerDay,
      };
    }

    return { valid: true, used: documentsToday, limit: limits.documentsPerDay };
  } catch (error) {
    console.error('Failed to check daily quota:', error);
    return { valid: true };
  }
}

/**
 * Validate monthly document processing quota
 */
export async function validateMonthlyQuota(userId: string): Promise<{ valid: boolean; message?: string; used?: number; limit?: number }> {
  const limits = await getEffectivePlanLimits(userId);
  
  // If unlimited, always valid
  if (limits.documentsPerMonth === -1) {
    return { valid: true, used: 0, limit: -1 };
  }

  // Get current month's usage
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  try {
    const { items } = await listDocsStore({
      caller: id(),
      collection: 'usage',
      params: {}
    });

    // Sum up documents for current month
    const monthPrefix = `${userId}_${year}-${month}`;
    const documentsThisMonth = items
      .filter(([key]) => key.startsWith(monthPrefix))
      .reduce((sum, [_, doc]) => sum + ((decodeDocData(doc.data) as any)?.documentsProcessed || 0), 0);

    if (documentsThisMonth >= limits.documentsPerMonth) {
      return {
        valid: false,
        message: `Monthly limit reached. You have processed ${documentsThisMonth}/${limits.documentsPerMonth} documents this month.`,
        used: documentsThisMonth,
        limit: limits.documentsPerMonth,
      };
    }

    return { valid: true, used: documentsThisMonth, limit: limits.documentsPerMonth };
  } catch (error) {
    console.error('Failed to check monthly quota:', error);
    return { valid: true };
  }
}

/**
 * Check if user is platform admin (exempt from all limits)
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  try {
    const doc = await getDocStore({
      caller: id(),
      collection: 'platform_admins',
      key: userId,
    });
    return doc !== undefined && doc !== null;
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
}

/**
 * Rollback function interface
 */
export interface ValidationResult {
  success: boolean;
  rollback?: () => Promise<void>;
  error?: {
    code: 'subscription_expired' | 'quota_exceeded' | 'rate_limit' | 'server_error';
    message: string;
    limit?: number;
    used?: number;
  };
}

/**
 * Validate and increment bulk export quota with optimistic locking and rollback support
 * Returns a rollback function that can be called if subsequent validation fails
 */
export async function validateAndIncrementBulkExport(userId: string, caller: Uint8Array): Promise<ValidationResult> {
  const MAX_RETRIES = 10;
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const usageKey = `${userId}_${dateKey}`;

  // Get effective plan limits
  const limits = await getEffectivePlanLimits(userId);
  
  // Unlimited exports for enterprise
  if (limits.bulkExportsPerDay === -1) {
    return { success: true };
  }

  // Optimistic locking with retry
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Read current usage
      const usageDoc = await getDocStore({
        caller: id(),
        collection: 'export_usage',
        key: usageKey,
      });

      const currentCount = usageDoc ? (decodeDocData(usageDoc.data) as any)?.bulkExportsCount || 0 : 0;
      const currentVersion = usageDoc?.version;

      // Check if quota exceeded
      if (currentCount >= limits.bulkExportsPerDay) {
        return {
          success: false,
          error: {
            code: 'quota_exceeded',
            message: `Bulk export limit reached. You have used ${currentCount}/${limits.bulkExportsPerDay} bulk exports today.`,
            limit: limits.bulkExportsPerDay,
            used: currentCount,
          },
        };
      }

      // Attempt to increment with version check
      await setDocStore({
        caller: caller,
        collection: 'export_usage',
        key: usageKey,
        doc: {
          data: encodeDocData({
            bulkExportsCount: currentCount + 1,
            lastUpdated: Date.now(),
          }),
          version: currentVersion,
        },
      });

      // Success - create rollback function
      const rollback = async () => {
        for (let rollbackAttempt = 0; rollbackAttempt < MAX_RETRIES; rollbackAttempt++) {
          try {
            const currentDoc = await getDocStore({
              caller: id(),
              collection: 'export_usage',
              key: usageKey,
            });

            if (!currentDoc) return; // Already deleted or doesn't exist

            const count = (decodeDocData(currentDoc.data) as any)?.bulkExportsCount || 0;
            if (count === 0) return; // Already at zero

            await setDocStore({
              caller: caller,
              collection: 'export_usage',
              key: usageKey,
              doc: {
                data: encodeDocData({
                  bulkExportsCount: Math.max(0, count - 1),
                  lastUpdated: Date.now(),
                }),
                version: currentDoc.version,
              },
            });

            return; // Rollback succeeded
          } catch (rollbackError: any) {
            if (rollbackAttempt === MAX_RETRIES - 1) {
              console.error('Rollback failed after max retries:', rollbackError);
            }
            // Retry on version conflict
            await new Promise(resolve => setTimeout(resolve, 50 * (rollbackAttempt + 1)));
          }
        }
      };

      return { success: true, rollback };

    } catch (error: any) {
      // Retry on version conflict
      if (attempt === MAX_RETRIES - 1) {
        return {
          success: false,
          error: {
            code: 'server_error',
            message: 'Failed to increment bulk export quota after retries',
          },
        };
      }
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  return {
    success: false,
    error: {
      code: 'server_error',
      message: 'Failed to increment bulk export quota',
    },
  };
}

/**
 * Validate and increment download quota with optimistic locking and rollback support
 * Checks both daily and monthly limits
 */
export async function validateAndIncrementDownload(userId: string, caller: Uint8Array): Promise<ValidationResult> {
  const MAX_RETRIES = 10;
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const usageKey = `${userId}_${dateKey}`;

  // Get effective plan limits
  const limits = await getEffectivePlanLimits(userId);
  
  // Unlimited downloads for enterprise
  if (limits.documentsPerDay === -1 && limits.documentsPerMonth === -1) {
    return { success: true };
  }

  // Check monthly quota first (read-only, no increment yet)
  const monthlyCheck = await validateMonthlyQuota(userId);
  if (!monthlyCheck.valid) {
    return {
      success: false,
      error: {
        code: 'quota_exceeded',
        message: monthlyCheck.message || 'Monthly download limit reached',
        limit: monthlyCheck.limit,
        used: monthlyCheck.used,
      },
    };
  }

  // Optimistic locking with retry for daily quota
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Read current usage
      const usageDoc = await getDocStore({
        caller: id(),
        collection: 'usage',
        key: usageKey,
      });

      const currentCount = usageDoc ? (decodeDocData(usageDoc.data) as any)?.documentsProcessed || 0 : 0;
      const currentVersion = usageDoc?.version;

      // Check if daily quota exceeded
      if (limits.documentsPerDay !== -1 && currentCount >= limits.documentsPerDay) {
        return {
          success: false,
          error: {
            code: 'quota_exceeded',
            message: `Daily download limit reached. You have used ${currentCount}/${limits.documentsPerDay} downloads today.`,
            limit: limits.documentsPerDay,
            used: currentCount,
          },
        };
      }

      // Attempt to increment with version check
      await setDocStore({
        caller: caller,
        collection: 'usage',
        key: usageKey,
        doc: {
          data: encodeDocData({
            documentsProcessed: currentCount + 1,
            lastUpdated: Date.now(),
          }),
          version: currentVersion,
        },
      });

      // Success - create rollback function
      const rollback = async () => {
        for (let rollbackAttempt = 0; rollbackAttempt < MAX_RETRIES; rollbackAttempt++) {
          try {
            const currentDoc = await getDocStore({
              collection: 'usage',
              caller: id(),
              key: usageKey,
            });

            if (!currentDoc) return; // Already deleted or doesn't exist

            const count = (decodeDocData(currentDoc.data) as any)?.documentsProcessed || 0;
            if (count === 0) return; // Already at zero

            await setDocStore({
              caller: caller,
              collection: 'usage',
              key: usageKey,
              doc: {
                data: encodeDocData({
                  documentsProcessed: Math.max(0, count - 1),
                  lastUpdated: Date.now(),
                }),
                version: currentDoc.version,
              },
            });

            return; // Rollback succeeded
          } catch (rollbackError: any) {
            if (rollbackAttempt === MAX_RETRIES - 1) {
              console.error('Rollback failed after max retries:', rollbackError);
            }
            // Retry on version conflict
            await new Promise(resolve => setTimeout(resolve, 50 * (rollbackAttempt + 1)));
          }
        }
      };

      return { success: true, rollback };

    } catch (error: any) {
      // Retry on version conflict
      if (attempt === MAX_RETRIES - 1) {
        return {
          success: false,
          error: {
            code: 'server_error',
            message: 'Failed to increment download quota after retries',
          },
        };
      }
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  return {
    success: false,
    error: {
      code: 'server_error',
      message: 'Failed to increment download quota',
    },
  };
}
