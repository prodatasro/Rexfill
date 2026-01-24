// Subscription plan configuration
export interface PlanLimits {
  documentsPerDay: number; // -1 for unlimited
  documentsPerMonth: number; // -1 for unlimited
  maxTemplates: number; // -1 for unlimited
  maxFileSize: number; // in MB
  batchProcessing: boolean;
  prioritySupport: boolean;
  seatsIncluded?: number; // For organization plans, number of user seats included
}

export interface SubscriptionPlan {
  id: 'free' | 'starter' | 'professional' | 'enterprise' | 'team' | 'business' | 'enterprise_org';
  name: string;
  description: string;
  type: 'individual' | 'organization'; // Individual vs organization plan
  limits: PlanLimits;
  price: {
    monthly: number;
    annual: number;
  };
}

// Individual Plans
export const INDIVIDUAL_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out Rexfill',
    type: 'individual',
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
    name: 'Starter',
    description: 'For individual professionals',
    type: 'individual',
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
    name: 'Professional',
    description: 'For power users',
    type: 'individual',
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
    name: 'Enterprise',
    description: 'Unlimited for individuals',
    type: 'individual',
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

// Organization Plans (Multi-user with seat-based pricing)
export const ORGANIZATION_PLANS: Record<string, SubscriptionPlan> = {
  team: {
    id: 'team',
    name: 'Team',
    description: 'For small teams (5 users)',
    type: 'organization',
    limits: {
      documentsPerDay: 250, // Shared across all team members
      documentsPerMonth: 2500,
      maxTemplates: 500, // Shared template library
      maxFileSize: 50,
      batchProcessing: true,
      prioritySupport: true,
      seatsIncluded: 5,
    },
    price: { monthly: 49, annual: 490 },
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'For growing teams (15 users)',
    type: 'organization',
    limits: {
      documentsPerDay: 1000,
      documentsPerMonth: 10000,
      maxTemplates: 2000,
      maxFileSize: 75,
      batchProcessing: true,
      prioritySupport: true,
      seatsIncluded: 15,
    },
    price: { monthly: 129, annual: 1290 },
  },
  enterprise_org: {
    id: 'enterprise_org',
    name: 'Enterprise',
    description: 'For large organizations (50 users)',
    type: 'organization',
    limits: {
      documentsPerDay: -1,
      documentsPerMonth: -1,
      maxTemplates: -1,
      maxFileSize: 100,
      batchProcessing: true,
      prioritySupport: true,
      seatsIncluded: 50,
    },
    price: { monthly: 299, annual: 2990 },
  },
};

// Combined plans for easy lookup
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  ...INDIVIDUAL_PLANS,
  ...ORGANIZATION_PLANS,
};

export const getPlan = (planId: string): SubscriptionPlan => {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
};

export const isUnlimited = (value: number): boolean => value === -1;
