import { BaseRepository } from '../core/BaseRepository';

export interface AdminActionData {
  timestamp: number;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
}

/**
 * Repository for managing admin action logs
 */
export class AdminActionRepository extends BaseRepository<AdminActionData> {
  constructor() {
    super('admin_actions');
  }

  /**
   * List all admin actions sorted by timestamp (newest first)
   */
  async listAllSorted(limit?: number): Promise<Array<{ key: string; data: AdminActionData; created_at?: bigint; updated_at?: bigint }>> {
    const docs = await this.list();
    const sorted = docs.sort((a, b) => b.data.timestamp - a.data.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get actions by admin
   */
  async getByAdmin(adminId: string): Promise<Array<{ key: string; data: AdminActionData; created_at?: bigint; updated_at?: bigint }>> {
    const allActions = await this.listAllSorted();
    return allActions.filter(action => action.data.adminId === adminId);
  }

  /**
   * Get actions by action type
   */
  async getByActionType(actionType: string): Promise<Array<{ key: string; data: AdminActionData; created_at?: bigint; updated_at?: bigint }>> {
    const allActions = await this.listAllSorted();
    return allActions.filter(action => action.data.action === actionType);
  }

  /**
   * Get actions by target
   */
  async getByTarget(targetType: string, targetId?: string): Promise<Array<{ key: string; data: AdminActionData; created_at?: bigint; updated_at?: bigint }>> {
    const allActions = await this.listAllSorted();
    return allActions.filter(action => {
      if (action.data.targetType !== targetType) return false;
      if (targetId && action.data.targetId !== targetId) return false;
      return true;
    });
  }
}
