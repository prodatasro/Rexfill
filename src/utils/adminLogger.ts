import type { AdminAction, PlatformAdmin } from '../types';
import { adminRepository, userProfileRepository, subscriptionOverrideRepository } from '../dal';

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
    const key = `${adminId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const actionData: AdminAction = {
      adminId,
      action,
      targetType,
      targetId,
      changes,
      timestamp: Date.now(),
    };

    await adminRepository.logAction(key, actionData);
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure shouldn't break the actual action
  }
}

/**
 * Promote a user to platform admin
 * Only the first admin can perform this action
 */
export async function promoteToAdmin(
  currentAdminId: string,
  principalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Verify the caller is the first admin
    const admins = await adminRepository.list();

    if (admins.length === 0) {
      return { success: false, error: 'No admins found in system' };
    }

    const sortedAdmins = [...admins].sort((a, b) => {
      const aData = a.data as PlatformAdmin;
      const bData = b.data as PlatformAdmin;
      return aData.addedAt - bData.addedAt;
    });

    const firstAdmin = sortedAdmins[0];
    if (firstAdmin.key !== currentAdminId) {
      return { success: false, error: 'Only the first admin can add other admins' };
    }

    // 2. Check if user is already an admin
    const existingAdmin = admins.find(admin => admin.key === principalId.trim());
    if (existingAdmin) {
      return { success: false, error: 'User is already an admin' };
    }

    // 3. Validate that the user exists
    const userProfile = await userProfileRepository.get(principalId.trim());

    if (!userProfile) {
      return { success: false, error: 'User not found. Please check the Principal ID.' };
    }

    // 4. Add the user as an admin
    await adminRepository.addAdmin(principalId.trim(), currentAdminId);

    // 5. Log the action
    await logAdminAction(
      currentAdminId,
      'promote_to_admin',
      'user',
      principalId.trim(),
      { displayName: userProfile.data.displayName }
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to promote user to admin:', error);
    return { success: false, error: 'Failed to promote user to admin' };
  }
}

/**
 * Revoke admin access from a user
 * Only the first admin can perform this action
 * Cannot remove the first admin or the last remaining admin
 */
export async function revokeAdmin(
  currentAdminId: string,
  principalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get all admins
    const admins = await adminRepository.list();

    if (admins.length === 0) {
      return { success: false, error: 'No admins found in system' };
    }

    const sortedAdmins = [...admins].sort((a, b) => {
      const aData = a.data as PlatformAdmin;
      const bData = b.data as PlatformAdmin;
      return aData.addedAt - bData.addedAt;
    });

    const firstAdmin = sortedAdmins[0];

    // 2. Verify the caller is the first admin
    if (firstAdmin.key !== currentAdminId) {
      return { success: false, error: 'Only the first admin can revoke admin access' };
    }

    // 3. Prevent removing the first admin
    if (principalId.trim() === firstAdmin.key) {
      return { success: false, error: 'Cannot remove the first admin' };
    }

    // 4. Prevent removing the last remaining admin (should never happen since first admin can't be removed, but defensive)
    if (admins.length <= 1) {
      return { success: false, error: 'Cannot remove the last remaining admin' };
    }

    // 5. Check if the user is actually an admin
    const targetAdmin = admins.find(admin => admin.key === principalId.trim());
    if (!targetAdmin) {
      return { success: false, error: 'User is not an admin' };
    }

    // 6. Remove the admin
    await adminRepository.removeAdmin(principalId.trim());

    // 7. Log the action
    await logAdminAction(
      currentAdminId,
      'revoke_admin',
      'user',
      principalId.trim()
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to revoke admin access:', error);
    return { success: false, error: 'Failed to revoke admin access' };
  }
}

/**
 * Check if a user is suspended
 */
export async function isUserSuspended(userId: string): Promise<boolean> {
  try {
    return await adminRepository.isSuspended(userId);
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
    const doc = await subscriptionOverrideRepository.getByUser(userId);
    
    if (!doc) return null;
    
    const override = doc.data;
    
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
