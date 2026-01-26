import { setDoc, getDoc } from '@junobuild/core';
import type { AdminAction } from '../types';

/**
 * Log an admin action to the admin_actions collection
 * All admin collections use "managed" privacy for admin-only access
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const actionData: AdminAction = {
      adminId,
      action,
      targetType,
      targetId,
      changes,
      timestamp: Date.now(),
    };

    const key = `${adminId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await setDoc({
      collection: 'admin_actions',
      doc: {
        key,
        data: actionData,
      },
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure shouldn't break the actual action
  }
}

/**
 * Check if a user is suspended
 */
export async function isUserSuspended(userId: string): Promise<boolean> {
  try {
    const doc = await getDoc({
      collection: 'suspended_users',
      key: userId,
    });
    return doc !== undefined && doc !== null;
  } catch (error) {
    console.error('Failed to check user suspension:', error);
    return false;
  }
}

/**
 * Get subscription override for a user
 */
export async function getSubscriptionOverride(userId: string) {
  try {
    const doc = await getDoc({
      collection: 'subscription_overrides',
      key: userId,
    });
    
    if (!doc) return null;
    
    const override = doc.data as any;
    
    // Check if override has expired
    if (override.expiresAt && override.expiresAt < Date.now()) {
      return null;
    }
    
    return override;
  } catch (error) {
    console.error('Failed to get subscription override:', error);
    return null;
  }
}
