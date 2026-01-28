// Subscription plan configuration
export interface PlanLimits {
  documentsPerDay: number; // -1 for unlimited
  documentsPerMonth: number; // -1 for unlimited
  bulkExportsPerDay: number; // -1 for unlimited, number of bulk export operations allowed per day
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
      bulkExportsPerDay: 1,
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
      bulkExportsPerDay: 3,
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
      bulkExportsPerDay: 10,
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
      bulkExportsPerDay: -1,
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
      bulkExportsPerDay: 5,
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
      bulkExportsPerDay: 15,
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
      bulkExportsPerDay: -1,
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

/**
 * Map Paddle price ID to plan ID
 * Price IDs come from environment variables (works in both client and satellite)
 * Note: In satellite functions, use process.env instead of import.meta.env
 */
export const getPlanIdFromPaddlePrice = (priceId: string, env?: Record<string, string>): string => {
  // Use provided env (for satellite) or import.meta.env (for client)
  const getEnv = (key: string): string => {
    if (env) return env[key] || '';
    return import.meta.env[key] || '';
  };

  const priceMapping: Record<string, string> = {
    // Individual plans - monthly
    [getEnv('VITE_PADDLE_PRICE_STARTER_MONTHLY')]: 'starter',
    [getEnv('VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY')]: 'professional',
    [getEnv('VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY')]: 'enterprise',
    
    // Individual plans - annual
    [getEnv('VITE_PADDLE_PRICE_STARTER_ANNUAL')]: 'starter',
    [getEnv('VITE_PADDLE_PRICE_PROFESSIONAL_ANNUAL')]: 'professional',
    [getEnv('VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL')]: 'enterprise',
    
    // Organization plans - monthly
    [getEnv('VITE_PADDLE_PRICE_TEAM_MONTHLY')]: 'team',
    [getEnv('VITE_PADDLE_PRICE_BUSINESS_MONTHLY')]: 'business',
    [getEnv('VITE_PADDLE_PRICE_ENTERPRISE_ORG_MONTHLY')]: 'enterprise_org',
    
    // Organization plans - annual
    [getEnv('VITE_PADDLE_PRICE_TEAM_ANNUAL')]: 'team',
    [getEnv('VITE_PADDLE_PRICE_BUSINESS_ANNUAL')]: 'business',
    [getEnv('VITE_PADDLE_PRICE_ENTERPRISE_ORG_ANNUAL')]: 'enterprise_org',
  };

  return priceMapping[priceId] || 'free';
};

/**
 * Get seat count for a plan from its configuration
 * Returns undefined for individual plans (no seats)
 */
export const getSeatsIncluded = (planId: string): number | undefined => {
  return SUBSCRIPTION_PLANS[planId]?.limits.seatsIncluded;
};

// ==============================================================================
// RATE LIMITS CONFIGURATION (Server-Side Enforcement)
// ==============================================================================
// TODO: Uncomment and configure these when implementing server-side rate limiting
// 
// /**
//  * Rate limit configuration per endpoint and plan tier
//  * These limits are enforced server-side in Juno satellite functions
//  * Platform admins are exempt from all rate limiting
//  */
// export interface RateLimits {
//   downloads: number;    // Downloads per minute
//   uploads: number;      // Template uploads per minute
//   exports: number;      // Bulk exports per minute
//   processing: number;   // Document processing per minute
// }
//
// /**
//  * Suggested rate limits per plan tier
//  * Adjust these values based on infrastructure capacity and business requirements
//  */
// export const PLAN_RATE_LIMITS: Record<string, RateLimits> = {
//   free: {
//     downloads: 10,      // 10 downloads per minute
//     uploads: 5,         // 5 uploads per minute
//     exports: 2,         // 2 exports per minute
//     processing: 10,     // 10 document processing operations per minute
//   },
//   starter: {
//     downloads: 20,      // 20 downloads per minute
//     uploads: 15,        // 15 uploads per minute
//     exports: 5,         // 5 exports per minute
//     processing: 30,     // 30 document processing operations per minute
//   },
//   professional: {
//     downloads: 50,      // 50 downloads per minute
//     uploads: 30,        // 30 uploads per minute
//     exports: 10,        // 10 exports per minute
//     processing: 100,    // 100 document processing operations per minute
//   },
//   enterprise: {
//     downloads: -1,      // Unlimited (rate limiting disabled)
//     uploads: -1,        // Unlimited
//     exports: -1,        // Unlimited
//     processing: -1,     // Unlimited
//   },
//   team: {
//     downloads: 40,      // Shared across team members
//     uploads: 20,        // Shared across team members
//     exports: 8,         // Shared across team members
//     processing: 60,     // Shared across team members
//   },
//   business: {
//     downloads: 100,     // Shared across team members
//     uploads: 50,        // Shared across team members
//     exports: 20,        // Shared across team members
//     processing: 200,    // Shared across team members
//   },
//   enterprise_org: {
//     downloads: -1,      // Unlimited
//     uploads: -1,        // Unlimited
//     exports: -1,        // Unlimited
//     processing: -1,     // Unlimited
//   },
// };
//
// /**
//  * Get rate limits for a specific plan
//  * Returns free tier limits if plan not found
//  */
// export const getRateLimits = (planId: string): RateLimits => {
//   return PLAN_RATE_LIMITS[planId] || PLAN_RATE_LIMITS.free;
// };
