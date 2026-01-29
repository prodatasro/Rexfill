import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { getDoc, setDoc, listDocs } from '@junobuild/core';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useUserProfile } from './UserProfileContext';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, isUnlimited } from '../config/plans';
import { SubscriptionData, UsageSummary, PlanId, SubscriptionType } from '../types/subscription';
import { logActivity } from '../utils/activityLogger';

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  subscription: SubscriptionData | null;
  subscriptionData: SubscriptionData | null;
  individualSubscription: SubscriptionData | null; // User's personal subscription
  organizationSubscription: SubscriptionData | null; // Organization's subscription if user is member
  usage: UsageSummary;
  usageSummary: UsageSummary;
  isLoading: boolean;
  canProcessDocument: () => boolean;
  canUploadTemplate: () => boolean;
  incrementDocumentUsage: () => Promise<void>;
  incrementTemplateCount: () => Promise<void>;
  decrementTemplateCount: () => Promise<void>;
  checkLimits: () => { withinLimits: boolean; message?: string };
  upgradePromptVisible: boolean;
  showUpgradePrompt: () => void;
  hideUpgradePrompt: () => void;
  refreshUsage: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  updateSubscription: (planId: PlanId, paddleData?: { subscriptionId: string; customerId: string }) => Promise<void>;
  gracePeriodEndsAt: number | null; // If organization subscription is in grace period
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [individualSubscription, setIndividualSubscription] = useState<SubscriptionData | null>(null);
  const [organizationSubscription, setOrganizationSubscription] = useState<SubscriptionData | null>(null);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageSummary>({
    documentsToday: 0,
    documentsThisMonth: 0,
    totalTemplates: 0,
    lastUpdated: Date.now(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [upgradePromptVisible, setUpgradePromptVisible] = useState(false);

  // Get the current plan based on subscription
  // Organization subscription takes precedence over individual
  const plan = subscription?.planId
    ? SUBSCRIPTION_PLANS[subscription.planId]
    : SUBSCRIPTION_PLANS.free;

  // Load subscription and usage data from Juno
  const loadSubscription = useCallback(async () => {
      if (!user) {
        setSubscription(null);
        setUsage({
          documentsToday: 0,
          documentsThisMonth: 0,
          totalTemplates: 0,
          lastUpdated: Date.now(),
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Load individual subscription from Juno datastore
        const subscriptionDoc = await getDoc({
          collection: 'subscriptions',
          key: user.key,
        });

        let userIndividualSub: SubscriptionData | null = null;

        if (subscriptionDoc) {
          userIndividualSub = subscriptionDoc.data as SubscriptionData;
          setIndividualSubscription(userIndividualSub);
        } else {
          // Create default free subscription for new users
          const defaultSubscription: SubscriptionData = {
            planId: 'free' as PlanId,
            status: 'active',
            type: 'individual' as SubscriptionType,
            currentPeriodStart: Date.now(),
            currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            cancelAtPeriodEnd: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          await setDoc({
            collection: 'subscriptions',
            doc: {
              key: user.key,
              data: defaultSubscription,
            },
          });

          userIndividualSub = defaultSubscription;
          setIndividualSubscription(defaultSubscription);
        }

        // Check if user is member of an organization
        const membershipDocs = await listDocs({
          collection: 'organization_members',
        });

        const userMembership = membershipDocs.items.find(
          doc => (doc.data as any).userId === user.key
        );

        let orgSub: SubscriptionData | null = null;

        if (userMembership) {
          const memberData = userMembership.data as any;
          const organizationId = memberData.organizationId;

          // Load organization
          const orgDoc = await getDoc({
            collection: 'organizations',
            key: organizationId,
          });

          if (orgDoc) {
            const orgData = orgDoc.data as any;
            
            // Load organization's subscription if it has one
            if (orgData.subscriptionId) {
              const orgSubDoc = await getDoc({
                collection: 'subscriptions',
                key: orgData.subscriptionId,
              });

              if (orgSubDoc) {
                orgSub = orgSubDoc.data as SubscriptionData;
                setOrganizationSubscription(orgSub);

                // Check for grace period
                if ((orgSub as any).gracePeriodEndsAt) {
                  setGracePeriodEndsAt((orgSub as any).gracePeriodEndsAt);
                }
              }
            }
          }
        }

        // Set active subscription: organization takes precedence
        if (orgSub && orgSub.status === 'active') {
          setSubscription(orgSub);
        } else {
          setSubscription(userIndividualSub);
        }

        // Skip loading usage for admins (they have unlimited access)
        if (isAdmin) {
          setUsage({
            documentsToday: 0,
            documentsThisMonth: 0,
            totalTemplates: 0,
            lastUpdated: Date.now(),
          });
        } else {
          // Load usage from Juno datastore (read-only)
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const usageDoc = await getDoc({
            collection: 'usage',
            key: `${user.key}_${today}`,
          });

          if (usageDoc) {
          const usageData = usageDoc.data as any;
          
          // Calculate monthly usage by querying all docs for current month
          const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          const monthlyDocs = await listDocs({
            collection: 'usage',
            filter: {
              matcher: {
                key: `${user.key}_${thisMonth}`,
              },
            },
          });

          let documentsThisMonth = 0;
          monthlyDocs.items.forEach(doc => {
            documentsThisMonth += (doc.data as any).documentsProcessed || 0;
          });

          // Get total templates count (from templates_meta collection)
          const templateDocs = await listDocs({
            collection: 'templates_meta',
            filter: {
              owner: user.key,
            },
          });

          setUsage({
            documentsToday: usageData.documentsProcessed || 0,
            documentsThisMonth,
            totalTemplates: templateDocs.items.length,
            lastUpdated: Date.now(),
          });
        } else {
          // No usage document exists yet - set to zero (satellite will create it on first use)
          const templateDocs = await listDocs({
            collection: 'templates_meta',
            filter: {
              owner: user.key,
            },
          });

          setUsage({
            documentsToday: 0,
            documentsThisMonth: 0,
            totalTemplates: templateDocs.items.length,
            lastUpdated: Date.now(),
          });
          }
        }
      } catch (error) {
        console.error('Failed to load subscription data:', error);
        
        // Fallback to default free plan
        setSubscription({
          planId: 'free' as PlanId,
          status: 'active',
          type: 'individual' as SubscriptionType,
          currentPeriodStart: Date.now(),
          currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
          cancelAtPeriodEnd: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    }, [user, isAdmin]);

  // Load on mount and when user/isAdmin changes
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Listen for Paddle checkout completion events
  useEffect(() => {
    const handleCheckoutCompleted = async (event: Event) => {
      console.log('🔴 [PADDLE_CHECKOUT] ========== CHECKOUT EVENT FIRED ==========');
      console.log('[PADDLE_CHECKOUT] Event detail:', (event as CustomEvent).detail);
      console.log('[PADDLE_CHECKOUT] Current user:', user);
      
      if (!user) {
        console.error('[PADDLE_CHECKOUT] ❌ No user logged in, aborting');
        return;
      }

      const eventDetail = (event as CustomEvent).detail;
      const subscriptionId = eventDetail?.transaction?.subscription_id || eventDetail?.subscriptionId;

      console.log('[PADDLE_CHECKOUT] Extracted subscription ID:', subscriptionId);

      if (!subscriptionId) {
        console.error('[PADDLE_CHECKOUT] ❌ No subscription ID found in checkout event');
        toast.error('Payment confirmed, but subscription ID not found. Please contact support.');
        return;
      }

      // Show immediate feedback
      toast.success('Payment confirmed! Syncing your subscription...');

      console.log('[PADDLE_CHECKOUT] Calling setDoc with data:', {
        key: user.key,
        paddleSubscriptionId: subscriptionId,
        status: 'pending_verification',
        needsRefresh: true,
      });

      // Create/update subscription document with needsRefresh flag
      // This triggers the onSetDoc hook which fetches from Paddle API
      try {
        const result = await setDoc({
          collection: 'subscriptions',
          doc: {
            key: user.key,
            data: {
              ...(subscription || {}),
              paddleSubscriptionId: subscriptionId,
              status: 'pending_verification',
              needsRefresh: true,
              lastSyncAttempt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        });

        console.log('[PADDLE_CHECKOUT] ✅ setDoc completed successfully, result:', result);
        console.log('[PADDLE_CHECKOUT] Hook should fire now - check satellite logs at http://localhost:5866');
        toast.loading('Fetching subscription details from Paddle...');
      } catch (error) {
        console.error('[PADDLE_CHECKOUT] ❌ Error updating subscription:', error);
        toast.error('Failed to initialize subscription sync');
      }
    };

    console.log('[PADDLE_CHECKOUT] Event listener registered for paddle:checkout-completed');
    window.addEventListener('paddle:checkout-completed', handleCheckoutCompleted);
    
    return () => {
      console.log('[PADDLE_CHECKOUT] Event listener removed');
      window.removeEventListener('paddle:checkout-completed', handleCheckoutCompleted);
    };
  }, [user, subscription]);

  // Listen for subscription updates from other tabs
  useEffect(() => {
    const handleStorageChange = async (event: StorageEvent) => {
      if (event.key === 'subscription_updated' && user) {
        console.log('[SUBSCRIPTION_SYNC] Subscription updated in another tab, refreshing...');
        
        try {
          const subscriptionDoc = await getDoc({
            collection: 'subscriptions',
            key: user.key,
          });
          
          if (subscriptionDoc) {
            setSubscription(subscriptionDoc.data as SubscriptionData);
          }
        } catch (error) {
          console.error('[SUBSCRIPTION_SYNC] Failed to sync subscription:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  /**
   * UI hint only - optimistic check for user experience
   * Server enforces actual limits via assertion hooks and validation endpoints
   * @see src/satellite/index.ts for server-side enforcement
   */
  const canProcessDocument = useCallback(() => {
    if (isAdmin) return true; // Admins have unlimited access
    if (isUnlimited(plan.limits.documentsPerDay)) return true;
    if (usage.documentsToday >= plan.limits.documentsPerDay) return false;
    if (!isUnlimited(plan.limits.documentsPerMonth) && usage.documentsThisMonth >= plan.limits.documentsPerMonth) return false;
    return true;
  }, [plan, usage, isAdmin]);

  /**
   * UI hint only - optimistic check for user experience
   * Server enforces actual limits via assertion hooks and validation endpoints
   * @see src/satellite/index.ts for server-side enforcement
   */
  const canUploadTemplate = useCallback(() => {
    if (isAdmin) return true; // Admins have unlimited access
    if (isUnlimited(plan.limits.maxTemplates)) return true;
    return usage.totalTemplates < plan.limits.maxTemplates;
  }, [plan, usage, isAdmin]);

  /**
   * REMOVED: Usage increments now happen server-side only
   * Server tracks usage atomically during validation to prevent client-side manipulation
   * @deprecated This function is a no-op - server increments usage in download-validator.ts
   */
  const incrementDocumentUsage = useCallback(async () => {
    // NO-OP: Server handles usage increments
    console.warn('incrementDocumentUsage is deprecated - server handles usage tracking');
  }, []);

  /**
   * UI-only function for optimistic template count updates
   * Server enforces actual limits via assertion hooks
   */
  const incrementTemplateCount = useCallback(async () => {
    if (!user) return;

    // Update local state only (server validates via assertUploadAsset)
    setUsage((prev) => ({
      ...prev,
      totalTemplates: prev.totalTemplates + 1,
      lastUpdated: Date.now(),
    }));
  }, [user]);

  /**
   * UI-only function for optimistic template count updates
   * Server enforces actual limits via assertion hooks
   */
  const decrementTemplateCount = useCallback(async () => {
    if (!user) return;

    // Update local state only (server validates via assertDeleteAsset)
    setUsage((prev) => ({
      ...prev,
      totalTemplates: Math.max(0, prev.totalTemplates - 1),
      lastUpdated: Date.now(),
    }));
  }, [user]);

  const checkLimits = useCallback(() => {
    // Admins have no limits
    if (isAdmin) return { withinLimits: true };
    
    // Check daily limit
    if (!isUnlimited(plan.limits.documentsPerDay)) {
      const remainingToday = plan.limits.documentsPerDay - usage.documentsToday;
      if (remainingToday <= 0) {
        return { withinLimits: false, message: 'subscription.upgrade.limitReached' };
      }
      if (remainingToday <= 2) {
        return { withinLimits: true, message: 'subscription.upgrade.nearLimit' };
      }
    }

    // Check monthly limit
    if (!isUnlimited(plan.limits.documentsPerMonth)) {
      const remainingMonth = plan.limits.documentsPerMonth - usage.documentsThisMonth;
      if (remainingMonth <= 0) {
        return { withinLimits: false, message: 'subscription.upgrade.limitReached' };
      }
    }

    return { withinLimits: true };
  }, [plan, usage, isAdmin]);

  const showUpgradePrompt = useCallback(() => {
    setUpgradePromptVisible(true);
  }, []);

  const hideUpgradePrompt = useCallback(() => {
    setUpgradePromptVisible(false);
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    
    // Skip loading usage for admins
    if (isAdmin) {
      setUsage({
        documentsToday: 0,
        documentsThisMonth: 0,
        totalTemplates: 0,
        lastUpdated: Date.now(),
      });
      return;
    }
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageDoc = await getDoc({
        collection: 'usage',
        key: `${user.key}_${today}`,
      });

      if (usageDoc) {
        const usageData = usageDoc.data as any;
        
        // Calculate monthly usage
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthlyDocs = await listDocs({
          collection: 'usage',
          filter: {
            matcher: {
              key: `${user.key}_${thisMonth}`,
            },
          },
        });

        let documentsThisMonth = 0;
        monthlyDocs.items.forEach(doc => {
          documentsThisMonth += (doc.data as any).documentsProcessed || 0;
        });

        // Get total templates count
        const templateDocs = await listDocs({
          collection: 'templates_meta',
          filter: {
            owner: user.key,
          },
        });

        setUsage({
          documentsToday: usageData.documentsProcessed || 0,
          documentsThisMonth,
          totalTemplates: templateDocs.items.length,
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error('Failed to refresh usage:', error);
    }
  }, [user, isAdmin]);

  /**
   * Manual refresh subscription from Paddle API
   * Uses trigger collection pattern to avoid version conflicts
   */
  const refreshSubscription = useCallback(async () => {
    if (!user) {
      toast.error('No user found');
      return;
    }

    try {
      toast.loading('Refreshing subscription from Paddle...');
      
      // Create a sync trigger (event-driven pattern)
      const triggerId = `${user.key}_${Date.now()}`;
      
      await setDoc({
        collection: 'paddle_sync_triggers',
        doc: {
          key: triggerId,
          data: {
            userId: user.key,
            subscriptionId: subscription?.paddleSubscriptionId,
            triggeredAt: Date.now(),
            source: 'manual_refresh',
          },
        },
      });
      
      console.log('[REFRESH_SUBSCRIPTION] Sync trigger created:', triggerId);
      
      // Give the hook a moment to process, then reload
      setTimeout(async () => {
        await loadSubscription();
        toast.dismiss();
        toast.success('Subscription refreshed');
      }, 2000);
      
    } catch (error: any) {
      console.error('[REFRESH_SUBSCRIPTION] Error:', error);
      toast.error('Failed to refresh subscription');
    }
  }, [user, subscription, loadSubscription]);

  const updateSubscription = useCallback(async (planId: PlanId, paddleData?: { subscriptionId: string; customerId: string }) => {
    if (!user) return;

    const oldPlan = subscription?.planId || 'free';
    
    try {
      const planConfig = SUBSCRIPTION_PLANS[planId];
      const newSubscription: SubscriptionData = {
        planId,
        status: 'active',
        type: planConfig.type === 'organization' ? 'organization' : 'individual',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: subscription?.createdAt || Date.now(),
        updatedAt: Date.now(),
        ...(paddleData && {
          paddleSubscriptionId: paddleData.subscriptionId,
          paddleCustomerId: paddleData.customerId,
        }),
        ...(planConfig.limits.seatsIncluded && {
          seatsIncluded: planConfig.limits.seatsIncluded,
          seatsUsed: 1, // Initial user
        }),
      };

      // Save to Juno datastore
      await setDoc({
        collection: 'subscriptions',
        doc: {
          key: user.key,
          data: newSubscription,
          updated_at: BigInt(Date.now()),
        },
      });

      setSubscription(newSubscription);

      // Log subscription change
      await logActivity({
        action: 'updated',
        resource_type: 'subscription',
        resource_id: user.key,
        resource_name: `Subscription Change`,
        created_by: user.key,
        modified_by: user.key,
        success: true,
        old_value: oldPlan,
        new_value: planId,
      });
    } catch (error) {
      console.error('Failed to update subscription:', error);
      
      // Log failed subscription change
      await logActivity({
        action: 'updated',
        resource_type: 'subscription',
        resource_id: user.key,
        resource_name: `Subscription Change`,
        created_by: user.key,
        modified_by: user.key,
        success: false,
        old_value: oldPlan,
        new_value: planId,
        error_message: error instanceof Error ? error.message : 'Update failed',
      });

      throw error;
    }
  }, [user, subscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        subscription,
        subscriptionData: subscription,
        individualSubscription,
        organizationSubscription,
        usage,
        usageSummary: usage,
        isLoading,
        canProcessDocument,
        canUploadTemplate,
        incrementDocumentUsage,
        incrementTemplateCount,
        decrementTemplateCount,
        checkLimits,
        upgradePromptVisible,
        showUpgradePrompt,
        hideUpgradePrompt,
        refreshUsage,
        refreshSubscription,
        updateSubscription,
        gracePeriodEndsAt,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
