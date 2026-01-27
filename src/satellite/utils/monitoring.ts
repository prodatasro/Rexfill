/**
 * Monitoring Utility
 * 
 * Records security events for audit, compliance, and threat detection.
 * Events are retained indefinitely for forensic analysis.
 * 
 * Key Features:
 * - Composite key structure: {timestamp}_{userId}_{eventType}
 * - Severity levels stored in description for filtering
 * - Efficient time-based queries using createdAt timestamps
 * - Support for pagination when querying large event sets
 */

import { setDocStore } from '@junobuild/functions/sdk';
import { id } from '@junobuild/functions/ic-cdk';
import { encodeDocData } from '@junobuild/functions/sdk';

export type SecurityEventType =
  | 'quota_violation'
  | 'rate_limit_hit'
  | 'bypass_attempt'
  | 'suspicious_export'
  | 'subscription_canceled'
  | 'subscription_downgrade'
  | 'payment_failed'
  | 'admin_action'
  | 'unauthorized_access'
  | 'template_limit_exceeded'
  | 'file_size_exceeded'
  | 'override_applied'
  | 'override_removed'
  | 'user_suspended'
  | 'user_unsuspended';

export type SeverityLevel = 'info' | 'warning' | 'critical';

export interface SecurityEventData {
  eventType: SecurityEventType;
  severity: SeverityLevel;
  userId: string;
  endpoint?: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Record a security event to the security_events collection
 * Uses composite key format: {timestamp}_{userId}_{eventType}
 * Stores severity in description for filtering via regex
 */
export async function recordSecurityEvent(event: SecurityEventData): Promise<void> {
  const timestamp = event.timestamp || Date.now();
  
  // Composite key for efficient time-based queries
  const key = `${timestamp}_${event.userId}_${event.eventType}`;
  
  // Store severity in description for filtering
  const description = `severity:${event.severity};message:${event.message}`;

  try {
    await setDocStore({
      caller: id(),
      collection: 'security_events',
      key,
      doc: {
        data: encodeDocData({
          eventType: event.eventType,
          severity: event.severity,
          userId: event.userId,
          endpoint: event.endpoint,
          message: event.message,
          metadata: event.metadata || {},
          timestamp,
          description,
        }),
        version: undefined,
      },
    });
  } catch (error) {
    console.error('Failed to record security event:', error);
    // Don't throw - security logging should not block operations
  }
}

/**
 * Log quota violation event
 */
export async function logQuotaViolation(
  userId: string,
  quotaType: 'daily' | 'monthly' | 'templates' | 'file_size',
  details: { limit: number; current: number; planId: string }
): Promise<void> {
  await recordSecurityEvent({
    eventType: 'quota_violation',
    severity: 'warning',
    userId,
    message: `${quotaType} quota exceeded: ${details.current}/${details.limit}`,
    metadata: {
      quotaType,
      limit: details.limit,
      current: details.current,
      planId: details.planId,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log rate limit hit event
 */
export async function logRateLimitHit(
  userId: string,
  endpoint: string,
  details: { limit: number; retryAfter: number }
): Promise<void> {
  await recordSecurityEvent({
    eventType: 'rate_limit_hit',
    severity: 'warning',
    userId,
    endpoint,
    message: `Rate limit exceeded on ${endpoint}: retry after ${details.retryAfter}s`,
    metadata: {
      limit: details.limit,
      retryAfter: details.retryAfter,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log bypass attempt (e.g., direct API call without validation)
 */
export async function logBypassAttempt(
  userId: string,
  attemptType: string,
  details: Record<string, any>
): Promise<void> {
  await recordSecurityEvent({
    eventType: 'bypass_attempt',
    severity: 'critical',
    userId,
    message: `Security bypass attempt detected: ${attemptType}`,
    metadata: {
      attemptType,
      ...details,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log suspicious export activity
 */
export async function logSuspiciousExport(
  userId: string,
  details: { templateCount: number; planId: string; exportCount: number }
): Promise<void> {
  await recordSecurityEvent({
    eventType: 'suspicious_export',
    severity: 'warning',
    userId,
    endpoint: 'export',
    message: `Suspicious export pattern: ${details.exportCount} exports with ${details.templateCount} templates on ${details.planId} plan`,
    metadata: details,
    timestamp: Date.now(),
  });
}

/**
 * Log subscription changes
 */
export async function logSubscriptionEvent(
  userId: string,
  eventType: 'subscription_canceled' | 'subscription_downgrade' | 'payment_failed',
  details: Record<string, any>
): Promise<void> {
  const severity: SeverityLevel = eventType === 'payment_failed' ? 'warning' : 'info';
  
  await recordSecurityEvent({
    eventType,
    severity,
    userId,
    message: `Subscription event: ${eventType}`,
    metadata: details,
    timestamp: Date.now(),
  });
}

/**
 * Log admin actions (overrides, suspensions, etc.)
 */
export async function logAdminAction(
  adminId: string,
  actionType: SecurityEventType,
  targetUserId: string,
  details: Record<string, any>
): Promise<void> {
  await recordSecurityEvent({
    eventType: actionType,
    severity: 'info',
    userId: adminId,
    message: `Admin ${adminId} performed ${actionType} on user ${targetUserId}`,
    metadata: {
      targetUserId,
      ...details,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  userId: string,
  resource: string,
  reason: string
): Promise<void> {
  await recordSecurityEvent({
    eventType: 'unauthorized_access',
    severity: 'critical',
    userId,
    message: `Unauthorized access attempt to ${resource}: ${reason}`,
    metadata: {
      resource,
      reason,
    },
    timestamp: Date.now(),
  });
}
