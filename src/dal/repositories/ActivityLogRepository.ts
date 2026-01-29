import { BaseRepository } from '../core/BaseRepository';
import type { ActivityLogData } from '../../types/activity-log';
import type { Doc } from '@junobuild/core';
import type { QueryOptions } from '../core/types';

export class ActivityLogRepository extends BaseRepository<ActivityLogData> {
  constructor() {
    super('activity_logs');
  }

  /**
   * Get activity logs for a user
   */
  async getByUser(userId: string, limit?: number): Promise<Array<Doc<ActivityLogData>>> {
    const options: QueryOptions = {
      owner: userId,
      order: { desc: true, field: 'created_at' }
    };

    if (limit) {
      options.paginate = { limit };
    }

    return this.list(options);
  }

  /**
   * Get activity logs by action type
   */
  async getByAction(
    userId: string,
    action: ActivityLogData['action']
  ): Promise<Array<Doc<ActivityLogData>>> {
    const logs = await this.getByUser(userId);
    return logs.filter(log => log.data.action === action);
  }

  /**
   * Get activity logs by entity type
   */
  async getByEntity(
    userId: string,
    entityType: ActivityLogData['resource_type']
  ): Promise<Array<Doc<ActivityLogData>>> {
    const logs = await this.getByUser(userId);
    return logs.filter(log => log.data.resource_type === entityType);
  }

  /**
   * Get activity logs for a specific entity
   */
  async getByEntityId(
    userId: string,
    entityId: string
  ): Promise<Array<Doc<ActivityLogData>>> {
    const logs = await this.getByUser(userId);
    return logs.filter(log => log.data.resource_id === entityId);
  }

  /**
   * Get activity logs within date range
   */
  async getByDateRange(
    userId: string,
    startDate: number,
    endDate: number
  ): Promise<Array<Doc<ActivityLogData>>> {
    const logs = await this.getByUser(userId);
    return logs.filter(
      log => log.data.timestamp >= startDate && log.data.timestamp <= endDate
    );
  }

  /**
   * Create activity log
   */
  async log(
    userId: string,
    key: string,
    data: Omit<ActivityLogData, 'timestamp'>
  ): Promise<Doc<ActivityLogData>> {
    const log: ActivityLogData = {
      ...data,
      timestamp: Date.now()
    };

    return this.create(key, log, userId);
  }

  /**
   * Create multiple activity logs
   */
  async logBulk(
    logs: Array<{
      userId: string;
      key: string;
      data: Omit<ActivityLogData, 'timestamp'>;
    }>
  ): Promise<void> {
    const docs = logs.map(({ userId, key, data }) => ({
      key,
      data: {
        ...data,
        timestamp: Date.now()
      } as ActivityLogData,
      owner: userId
    }));

    await this.setMany(docs);
  }

  /**
   * Delete old activity logs (cleanup)
   */
  async deleteOlderThan(userId: string, timestamp: number): Promise<void> {
    const logs = await this.getByUser(userId);
    const oldLogs = logs.filter(log => log.data.timestamp < timestamp);

    await Promise.all(
      oldLogs.map(log => this.delete(log.key))
    );
  }
}
