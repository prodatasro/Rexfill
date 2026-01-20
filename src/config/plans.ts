// Subscription plan configuration
export interface PlanLimits {
  documentsPerDay: number; // -1 for unlimited
  documentsPerMonth: number; // -1 for unlimited
  maxTemplates: number; // -1 for unlimited
  maxFileSize: number; // in MB
  batchProcessing: boolean;
  prioritySupport: boolean;
}

export interface SubscriptionPlan {
  id: 'free' | 'starter' | 'professional' | 'enterprise';
  limits: PlanLimits;
  price: {
    monthly: number;
    annual: number;
  };
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    limits: {
      documentsPerDay: 5,
      documentsPerMonth: 50,
      maxTemplates: 10,
      maxFileSize: 10,
      batchProcessing: false,
      prioritySupport: false,
    },
    price: { monthly: 0, annual: 0 },
  },
  starter: {
    id: 'starter',
    limits: {
      documentsPerDay: 50,
      documentsPerMonth: 500,
      maxTemplates: 100,
      maxFileSize: 25,
      batchProcessing: true,
      prioritySupport: false,
    },
    price: { monthly: 9, annual: 90 },
  },
  professional: {
    id: 'professional',
    limits: {
      documentsPerDay: 200,
      documentsPerMonth: 2000,
      maxTemplates: 500,
      maxFileSize: 50,
      batchProcessing: true,
      prioritySupport: true,
    },
    price: { monthly: 29, annual: 290 },
  },
  enterprise: {
    id: 'enterprise',
    limits: {
      documentsPerDay: -1,
      documentsPerMonth: -1,
      maxTemplates: -1,
      maxFileSize: 100,
      batchProcessing: true,
      prioritySupport: true,
    },
    price: { monthly: 99, annual: 990 },
  },
};

export const getPlan = (planId: string): SubscriptionPlan => {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
};

export const isUnlimited = (value: number): boolean => value === -1;
