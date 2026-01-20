// Subscription and usage types

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export interface SubscriptionData {
  planId: PlanId;
  status: SubscriptionStatus;
  paddleSubscriptionId?: string;
  paddleCustomerId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
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
}
