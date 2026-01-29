// Subscription and usage types

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise' | 'team' | 'business' | 'enterprise_org';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';
export type SubscriptionType = 'individual' | 'organization';

export interface SubscriptionData {
  planId: PlanId;
  status: SubscriptionStatus;
  type: SubscriptionType; // Individual or organization subscription
  organizationId?: string; // Reference to organization if this is an org subscription
  seatsIncluded?: number; // Number of seats included in the plan (for org subscriptions)
  seatsUsed?: number; // Number of seats currently used (for org subscriptions)
  paddleSubscriptionId?: string;
  paddleCustomerId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
  // Paddle API sync fields (used by onSetDoc hook)
  needsRefresh?: boolean; // Flag to trigger Paddle API refresh
  lastSyncAttempt?: number; // Timestamp of last sync attempt
  lastSyncError?: string; // Error message from last sync attempt (if any)
}

export interface UsageData {
  date: string; // YYYY-MM-DD format for daily tracking
  documentsProcessed: number;
  templatesUploaded: number;
}

export interface MonthlyUsage {
  month: string; // YYYY-MM format
  documentsProcessed: number;
  templatesUploaded: number;
}

export interface UsageSummary {
  documentsToday: number;
  documentsThisMonth: number;
  totalTemplates: number;
  lastUpdated: number;
}

export interface ContactSubmission {
  id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: number;
  status: 'new' | 'read' | 'replied';
  repliedAt?: number;
  repliedBy?: string; // Principal ID of admin who replied
  reply?: string;
}
