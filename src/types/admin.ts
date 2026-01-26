// Admin-specific types

export interface PlatformAdmin {
  principalId: string;
  addedAt: number;
  addedBy: string; // Principal ID of admin who added this admin
}

export interface AdminAction {
  adminId: string; // Principal ID of admin who performed action
  action: string; // e.g., 'suspend_user', 'override_subscription', 'transfer_ownership'
  targetType: string; // e.g., 'user', 'organization', 'subscription'
  targetId: string; // ID of the affected entity
  changes?: Record<string, any>; // Optional details about what changed
  timestamp: number;
}

export interface SuspendedUser {
  userId: string; // Principal ID of suspended user
  reason: string;
  suspendedAt: number;
  suspendedBy: string; // Principal ID of admin who suspended
}

export interface SubscriptionOverride {
  userId: string; // Principal ID of user
  originalPlanId?: string;
  overridePlanId?: string;
  overrideQuotas?: {
    documentsPerDay?: number;
    documentsPerMonth?: number;
    maxTemplates?: number;
    maxFileSize?: number;
  };
  reason: string;
  expiresAt?: number; // Optional expiry timestamp
  createdAt: number;
  createdBy: string; // Principal ID of admin who created override
}

export interface WebhookHistory {
  eventType: string; // Paddle event type
  eventData: Record<string, any>; // Full webhook payload
  receivedAt: number;
  processed: boolean;
  error?: string; // Error message if processing failed
  signature?: string; // Webhook signature for verification
}

export interface ContactSubmissionWithReply {
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
