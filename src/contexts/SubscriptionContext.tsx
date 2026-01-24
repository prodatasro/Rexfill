import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, isUnlimited } from '../config/plans';
import { SubscriptionData, UsageSummary, PlanId } from '../types/subscription';
import { logActivity } from '../utils/activityLogger';

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  subscription: SubscriptionData | null;
  subscriptionData: SubscriptionData | null;
  usage: UsageSummary;
  usageSummary: UsageSummary;
  isLoading: boolean;
  canProcessDocument: () => boolean;
  canUploadTemplate: () => boolean;
  incrementDocumentUsage: () => Promise<void>;
  checkLimits: () => { withinLimits: boolean; message?: string };
  upgradePromptVisible: boolean;
  showUpgradePrompt: () => void;
  hideUpgradePrompt: () => void;
  refreshUsage: () => Promise<void>;
  updateSubscription: (planId: PlanId) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageSummary>({
    documentsToday: 0,
    documentsThisMonth: 0,
    totalTemplates: 0,
    lastUpdated: Date.now(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [upgradePromptVisible, setUpgradePromptVisible] = useState(false);

  // Get the current plan based on subscription
  const plan = subscription?.planId
    ? SUBSCRIPTION_PLANS[subscription.planId]
    : SUBSCRIPTION_PLANS.free;

  // Load subscription and usage data
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
        // TODO: Load subscription data from Juno datastore
        // For now, default to free plan
        const storedSubscription = localStorage.getItem(`subscription_${user.key}`);
        if (storedSubscription) {
          setSubscription(JSON.parse(storedSubscription));
        } else {
          // Default free subscription
          setSubscription({
            planId: 'free' as PlanId,
            status: 'active',
            currentPeriodStart: Date.now(),
            currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            cancelAtPeriodEnd: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        // Load usage from localStorage (will be replaced with Juno)
        const storedUsage = localStorage.getItem(`usage_${user.key}`);
        if (storedUsage) {
          const parsedUsage = JSON.parse(storedUsage);
          // Reset daily usage if it's a new day
          const today = new Date().toDateString();
          const lastUpdated = new Date(parsedUsage.lastUpdated).toDateString();
          if (today !== lastUpdated) {
            parsedUsage.documentsToday = 0;
          }
          // Reset monthly usage if it's a new month
          const thisMonth = new Date().toISOString().slice(0, 7);
          const lastMonth = new Date(parsedUsage.lastUpdated).toISOString().slice(0, 7);
          if (thisMonth !== lastMonth) {
            parsedUsage.documentsThisMonth = 0;
          }
          setUsage(parsedUsage);
        }
      } catch (error) {
        console.error('Failed to load subscription data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionData();
  }, [user]);

  // Save usage to localStorage when it changes
  useEffect(() => {
    if (user && usage.lastUpdated) {
      localStorage.setItem(`usage_${user.key}`, JSON.stringify(usage));
    }
  }, [user, usage]);

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
    setUsage((prev) => ({
      ...prev,
      documentsToday: prev.documentsToday + 1,
      documentsThisMonth: prev.documentsThisMonth + 1,
      lastUpdated: Date.now(),
    }));
    // TODO: Persist to Juno datastore
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
    // TODO: Reload usage from Juno
    // For now, just update the lastUpdated timestamp
    setUsage((prev) => ({ ...prev, lastUpdated: Date.now() }));
  }, []);

  const updateSubscription = useCallback(async (planId: PlanId) => {
    if (!user) return;

    const oldPlan = subscription?.planId || 'free';
    
    try {
      // TODO: Implement actual subscription update via Paddle/Juno
      const newSubscription: SubscriptionData = {
        planId,
        status: 'active',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: subscription?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      setSubscription(newSubscription);
      localStorage.setItem(`subscription_${user.key}`, JSON.stringify(newSubscription));

      // Log subscription change
      await logActivity({
        action: planId === 'free' || (subscription && planId < subscription.planId) ? 'updated' : 'updated',
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
        usage,
        usageSummary: usage,
        isLoading,
        canProcessDocument,
        canUploadTemplate,
        incrementDocumentUsage,
        checkLimits,
        upgradePromptVisible,
        showUpgradePrompt,
        hideUpgradePrompt,
        refreshUsage,
        updateSubscription,
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
