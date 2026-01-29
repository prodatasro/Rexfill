import { BaseRepository } from '../core/BaseRepository';
import type { 
  PlatformAdmin, 
  AdminAction, 
  SuspendedUser
} from '../../types/admin';
import type { Doc } from '@junobuild/core';

// Helper repository classes
class AdminActionRepository extends BaseRepository<AdminAction> {
  constructor() {
    super('admin_actions');
  }
}

class SuspendedUserRepository extends BaseRepository<SuspendedUser> {
  constructor() {
    super('suspended_users');
  }
}

// SecurityEvent placeholder (not in types yet)
interface SecurityEventData {
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventType: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

class SecurityEventRepository extends BaseRepository<SecurityEventData> {
  constructor() {
    super('security_events');
  }
}

export class AdminRepository extends BaseRepository<PlatformAdmin> {
  private adminActionsRepo: AdminActionRepository;
  private suspendedUsersRepo: SuspendedUserRepository;
  private securityEventsRepo: SecurityEventRepository;

  constructor() {
    super('platform_admins');
    this.adminActionsRepo = new AdminActionRepository();
    this.suspendedUsersRepo = new SuspendedUserRepository();
    this.securityEventsRepo = new SecurityEventRepository();
  }

  /**
   * Check if user is platform admin
   */
  async isAdmin(principal: string): Promise<boolean> {
    const admin = await this.get(principal);
    return admin !== undefined;
  }

  /**
   * Get all admins
   */
  async getAllAdmins(): Promise<Array<Doc<PlatformAdmin>>> {
    return this.list();
  }

  /**
   * Add admin
   */
  async addAdmin(
    principal: string,
    addedBy: string
  ): Promise<Doc<PlatformAdmin>> {
    const admin: PlatformAdmin = {
      principalId: principal,
      addedAt: Date.now(),
      addedBy
    };

    return this.create(principal, admin);
  }

  /**
   * Remove admin
   */
  async removeAdmin(principal: string): Promise<void> {
    await this.delete(principal);
  }

  // Admin Actions

  /**
   * Log admin action
   */
  async logAction(
    key: string,
    action: Omit<AdminAction, 'timestamp'>
  ): Promise<Doc<AdminAction>> {
    return this.adminActionsRepo.create(key, {
      ...action,
      timestamp: Date.now()
    });
  }

  /**
   * Get admin actions
   */
  async getActions(adminId?: string, limit?: number): Promise<Array<Doc<AdminAction>>> {
    const actions = await this.adminActionsRepo.list({
      order: { desc: true, field: 'created_at' },
      ...(limit && { paginate: { limit } })
    });

    if (adminId) {
      return actions.filter(a => a.data.adminId === adminId);
    }

    return actions;
  }

  /**
   * Get actions by target
   */
  async getActionsByTarget(targetId: string): Promise<Array<Doc<AdminAction>>> {
    const actions = await this.adminActionsRepo.list();
    return actions.filter(a => a.data.targetId === targetId);
  }

  // Suspended Users

  /**
   * Suspend user
   */
  async suspendUser(
    userId: string,
    reason: string,
    suspendedBy: string
  ): Promise<Doc<SuspendedUser>> {
    const suspension: SuspendedUser = {
      userId,
      reason,
      suspendedAt: Date.now(),
      suspendedBy
    };

    return this.suspendedUsersRepo.create(userId, suspension);
  }

  /**
   * Unsuspend user
   */
  async unsuspendUser(userId: string): Promise<void> {
    await this.suspendedUsersRepo.delete(userId);
  }

  /**
   * Check if user is suspended
   */
  async isSuspended(userId: string): Promise<boolean> {
    const suspension = await this.suspendedUsersRepo.get(userId);
    return suspension !== undefined;
  }

  /**
   * Get all suspended users
   */
  async getSuspendedUsers(): Promise<Array<Doc<SuspendedUser>>> {
    return this.suspendedUsersRepo.list();
  }

  // Security Events

  /**
   * Log security event
   */
  async logSecurityEvent(
    key: string,
    event: Omit<SecurityEventData, 'timestamp'>
  ): Promise<Doc<SecurityEventData>> {
    return this.securityEventsRepo.create(key, {
      ...event,
      timestamp: Date.now()
    });
  }

  /**
   * Get security events
   */
  async getSecurityEvents(
    userId?: string,
    severity?: SecurityEventData['severity'],
    limit?: number
  ): Promise<Array<Doc<SecurityEventData>>> {
    const events = await this.securityEventsRepo.list({
      order: { desc: true, field: 'created_at' },
      ...(limit && { paginate: { limit } })
    });

    let filtered = events;

    if (userId) {
      filtered = filtered.filter(e => e.data.userId === userId);
    }

    if (severity) {
      filtered = filtered.filter(e => e.data.severity === severity);
    }

    return filtered;
  }

  /**
   * Get recent security events (last 24 hours)
   */
  async getRecentSecurityEvents(severity?: SecurityEventData['severity']): Promise<Array<Doc<SecurityEventData>>> {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const events = await this.getSecurityEvents(undefined, severity);
    return events.filter(e => e.data.timestamp >= oneDayAgo);
  }
}
