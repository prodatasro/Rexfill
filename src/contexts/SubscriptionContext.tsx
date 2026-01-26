import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { getDoc, setDoc, listDocs } from '@junobuild/core';
import { useAuth } from './AuthContext';
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
  updateSubscription: (planId: PlanId, paddleData?: { subscriptionId: string; customerId: string }) => Promise<void>;
  gracePeriodEndsAt: number | null; // If organization subscription is in grace period
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
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
  useEffect(() => {
    const loadSubscriptionData = async () => {
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

        // Load usage from Juno datastore
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
          // Create initial usage document
          const initialUsage = {
            documentsProcessed: 0,
            templatesUploaded: 0,
          };

          await setDoc({
            collection: 'usage',
            doc: {
              key: `${user.key}_${today}`,
              data: initialUsage,
            },
          });

          // Get total templates count
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
    };

    loadSubscriptionData();
  }, [user]);

  // Listen for Paddle checkout completion events
  useEffect(() => {
    const handleCheckoutCompleted = async (event: Event) => {
      console.log('Paddle checkout completed, refreshing subscription...', (event as CustomEvent).detail);
      
      if (!user) return;

      // Poll for subscription update with exponential backoff
      const maxAttempts = 10;
      const pollInterval = 1000; // Start with 1 second
      let attempts = 0;

      const pollSubscription = async (): Promise<void> => {
        attempts++;
        
        try {
          const subscriptionDoc = await getDoc({
            collection: 'subscriptions',
            key: user.key,
          });
          
          if (subscriptionDoc) {
            setSubscription(subscriptionDoc.data as SubscriptionData);
            console.log('Subscription updated successfully');
            return;
          }
        } catch (error) {
          console.error('Failed to refresh subscription:', error);
        }

        if (attempts < maxAttempts) {
          const nextDelay = pollInterval * Math.pow(1.5, attempts - 1);
          setTimeout(() => pollSubscription(), nextDelay);
        } else {
          console.warn('Max polling attempts reached for subscription update');
        }
      };

      // Start polling after initial delay
      setTimeout(() => pollSubscription(), 1000);
    };

    window.addEventListener('paddle:checkout-completed', handleCheckoutCompleted);
    
    return () => {
      window.removeEventListener('paddle:checkout-completed', handleCheckoutCompleted);
    };
  }, [user]);

  const canProcessDocument = useCallback(() => {
    if (isUnlimited(plan.limits.documentsPerDay)) return true;
    if (usage.documentsToday >= plan.limits.documentsPerDay) return false;
    if (!isUnlimited(plan.limits.documentsPerMonth) && usage.documentsThisMonth >= plan.limits.documentsPerMonth) return false;
    return true;
  }, [plan, usage]);

  const canUploadTemplate = useCallback(() => {
    if (isUnlimited(plan.limits.maxTemplates)) return true;
    return usage.totalTemplates < plan.limits.maxTemplates;
  }, [plan, usage]);

  const incrementDocumentUsage = useCallback(async () => {
    if (!user) return;

    const newUsage = {
      ...usage,
      documentsToday: usage.documentsToday + 1,
      documentsThisMonth: usage.documentsThisMonth + 1,
      lastUpdated: Date.now(),
    };

    setUsage(newUsage);

    // Persist to Juno datastore
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageDoc = await getDoc({
        collection: 'usage',
        key: `${user.key}_${today}`,
      });

      const currentData = usageDoc?.data as any || { documentsProcessed: 0, templatesUploaded: 0 };

      await setDoc({
        collection: 'usage',
        doc: {
          key: `${user.key}_${today}`,
          data: {
            ...currentData,
            documentsProcessed: currentData.documentsProcessed + 1,
          },
          updated_at: BigInt(Date.now()),
        },
      });
    } catch (error) {
      console.error('Failed to persist usage:', error);
    }
  }, [user, usage]);

  const incrementTemplateCount = useCallback(async () => {
    setUsage((prev) => ({
      ...prev,
      totalTemplates: prev.totalTemplates + 1,
      lastUpdated: Date.now(),
    }));
  }, []);

  const decrementTemplateCount = useCallback(async () => {
    setUsage((prev) => ({
      ...prev,
      totalTemplates: Math.max(0, prev.totalTemplates - 1),
      lastUpdated: Date.now(),
    }));
  }, []);

  const checkLimits = useCallback(() => {
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
  }, [plan, usage]);

  const showUpgradePrompt = useCallback(() => {
    setUpgradePromptVisible(true);
  }, []);

  const hideUpgradePrompt = useCallback(() => {
    setUpgradePromptVisible(false);
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!user) return;

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
  }, [user]);

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
