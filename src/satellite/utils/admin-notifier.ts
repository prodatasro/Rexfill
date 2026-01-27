/**
 * Admin Notifier Utility
 * 
 * Creates notifications for platform administrators when thresholds are exceeded.
 * Notifications are stored with composite keys for efficient querying.
 * 
 * Key Features:
 * - Composite key format: {timestamp}_{severity}_{userId}
 * - Read/unread status in description field
 * - Threshold-based triggering
 * - Support for quick actions
 */

import { setDocStore, listDocsStore } from '@junobuild/functions/sdk';
import { id } from '@junobuild/functions/ic-cdk';
import { encodeDocData, decodeDocData } from '@junobuild/functions/sdk';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface AdminNotificationData {
  severity: NotificationSeverity;
  title: string;
  message: string;
  userId?: string; // User who triggered the notification
  actionType?: string;
  metadata?: Record<string, any>;
  quickActions?: QuickAction[];
}

export interface QuickAction {
  label: string;
  action: 'view_user' | 'apply_override' | 'suspend_user' | 'view_events';
  targetUserId?: string;
}

/**
 * Create an admin notification
 */
export async function createAdminNotification(notification: AdminNotificationData): Promise<void> {
  const timestamp = Date.now();
  
  // Composite key: {timestamp}_{severity}_{userId}
  const userPart = notification.userId || 'system';
  const key = `${timestamp}_${notification.severity}_${userPart}`;
  
  // Store read status in description for filtering
  const description = `read:false;severity:${notification.severity};title:${notification.title}`;

  try {
    await setDocStore({
      caller: id(),
      collection: 'admin_notifications',
      key,
      doc: {
        data: encodeDocData({
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          userId: notification.userId,
          actionType: notification.actionType,
          metadata: notification.metadata || {},
          quickActions: notification.quickActions || [],
          timestamp,
          read: false,
          description,
        }),
        version: undefined,
      },
    });
  } catch (error) {
    console.error('Failed to create admin notification:', error);
    // Don't throw - notification failures should not block operations
  }
}

/**
 * Check quota violation thresholds and notify if exceeded
 */
export async function checkQuotaViolationThreshold(userId: string, planId: string): Promise<void> {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  try {
    // Query recent security events
    const { items } = await listDocsStore({
      caller: id(),
      collection: 'security_events',
      params: {}
    });

    // Filter for recent quota violations for this user
    const violations = items.filter(([key, doc]) => {
      const data = decodeDocData(doc.data) as any;
      const keyTimestamp = parseInt(key.split('_')[0]);
      return keyTimestamp > oneHourAgo && 
             data.userId === userId && 
             data.eventType === 'quota_violation' &&
             data.severity === 'warning';
    });

    // Threshold: >100 quota violations in 1 hour
    if (violations.length > 100) {
      await createAdminNotification({
        severity: 'critical',
        title: 'Excessive Quota Violations',
        message: `User ${userId} has exceeded quota limits ${violations.length} times in the last hour`,
        userId,
        actionType: 'quota_violation_threshold',
        metadata: {
          violationCount: violations.length,
          planId,
          timeWindow: '1 hour',
        },
        quickActions: [
          { label: 'View User', action: 'view_user', targetUserId: userId },
          { label: 'Apply Override', action: 'apply_override', targetUserId: userId },
          { label: 'View Events', action: 'view_events', targetUserId: userId },
        ],
      });
    }
  } catch (error) {
    console.error('Failed to check quota violation threshold:', error);
  }
}

/**
 * Check rate limit hit threshold and notify if exceeded
 */
export async function checkRateLimitThreshold(userId: string, endpoint: string): Promise<void> {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  try {
    // Query recent security events
    const { items } = await listDocsStore({
      caller: id(),
      collection: 'security_events',
      params: {}
    });

    // Filter for recent rate limit hits for this user
    const rateLimitHits = items.filter(([key, doc]) => {
      const data = decodeDocData(doc.data) as any;
      const keyTimestamp = parseInt(key.split('_')[0]);
      return keyTimestamp > oneHourAgo && 
             data.userId === userId && 
             data.eventType === 'rate_limit_hit';
    });

    // Threshold: >50 rate limit hits in 1 hour
    if (rateLimitHits.length > 50) {
      await createAdminNotification({
        severity: 'warning',
        title: 'Excessive Rate Limit Hits',
        message: `User ${userId} has hit rate limits ${rateLimitHits.length} times in the last hour on ${endpoint}`,
        userId,
        actionType: 'rate_limit_threshold',
        metadata: {
          hitCount: rateLimitHits.length,
          endpoint,
          timeWindow: '1 hour',
        },
        quickActions: [
          { label: 'View User', action: 'view_user', targetUserId: userId },
          { label: 'Suspend User', action: 'suspend_user', targetUserId: userId },
          { label: 'View Events', action: 'view_events', targetUserId: userId },
        ],
      });
    }
  } catch (error) {
    console.error('Failed to check rate limit threshold:', error);
  }
}

/**
 * Check suspicious export patterns and notify
 */
export async function checkSuspiciousExportThreshold(userId: string, planId: string): Promise<void> {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  try {
    // Query recent security events
    const { items } = await listDocsStore({
      caller: id(),
      collection: 'security_events',
      params: {}
    });

    // Filter for recent suspicious exports for this user
    const suspiciousExports = items.filter(([key, doc]) => {
      const data = decodeDocData(doc.data) as any;
      const keyTimestamp = parseInt(key.split('_')[0]);
      return keyTimestamp > oneHourAgo && 
             data.userId === userId && 
             data.eventType === 'suspicious_export';
    });

    // Threshold: >10 large exports in 1 hour from free tier
    if (suspiciousExports.length > 10 && planId === 'free') {
      const totalTemplates = suspiciousExports.reduce((sum, [_, doc]) => {
        const data = decodeDocData(doc.data) as any;
        return sum + (data?.metadata?.templateCount || 0);
      }, 0);

      await createAdminNotification({
        severity: 'warning',
        title: 'Suspicious Export Activity',
        message: `User ${userId} on ${planId} plan has performed ${suspiciousExports.length} large exports (${totalTemplates} total templates) in the last hour`,
        userId,
        actionType: 'suspicious_export_threshold',
        metadata: {
          exportCount: suspiciousExports.length,
          totalTemplates,
          planId,
          timeWindow: '1 hour',
        },
        quickActions: [
          { label: 'View User', action: 'view_user', targetUserId: userId },
          { label: 'Apply Override', action: 'apply_override', targetUserId: userId },
          { label: 'View Events', action: 'view_events', targetUserId: userId },
        ],
      });
    }
  } catch (error) {
    console.error('Failed to check suspicious export threshold:', error);
  }
}

/**
 * Notify admins of subscription cancellation
 */
export async function notifySubscriptionCanceled(userId: string, details: Record<string, any>): Promise<void> {
  await createAdminNotification({
    severity: 'info',
    title: 'Subscription Canceled',
    message: `User ${userId} has canceled their subscription`,
    userId,
    actionType: 'subscription_canceled',
    metadata: details,
    quickActions: [
      { label: 'View User', action: 'view_user', targetUserId: userId },
    ],
  });
}

/**
 * Notify admins of webhook processing failure
 */
export async function notifyWebhookFailure(eventType: string, error: string): Promise<void> {
  await createAdminNotification({
    severity: 'critical',
    title: 'Webhook Processing Failed',
    message: `Failed to process ${eventType} webhook: ${error}`,
    actionType: 'webhook_failure',
    metadata: {
      eventType,
      error,
    },
  });
}

/**
 * Notify admins of bypass attempt
 */
export async function notifyBypassAttempt(userId: string, attemptType: string, details: Record<string, any>): Promise<void> {
  await createAdminNotification({
    severity: 'critical',
    title: 'Security Bypass Attempt Detected',
    message: `User ${userId} attempted to bypass ${attemptType} validation`,
    userId,
    actionType: 'bypass_attempt',
    metadata: {
      attemptType,
      ...details,
    },
    quickActions: [
      { label: 'View User', action: 'view_user', targetUserId: userId },
      { label: 'Suspend User', action: 'suspend_user', targetUserId: userId },
      { label: 'View Events', action: 'view_events', targetUserId: userId },
    ],
  });
}
