import { BaseRepository } from '../core/BaseRepository';

export interface SubscriptionOverrideData {
  userId: string;
  overrideQuotas: {
    documentsPerDay?: number;
    documentsPerMonth?: number;
    maxTemplates?: number;
    maxFileSize?: number;
  };
  reason: string;
  expiresAt?: number;
  createdAt: number;
  createdBy: string;
}

/**
 * Repository for managing subscription overrides
 */
export class SubscriptionOverrideRepository extends BaseRepository<SubscriptionOverrideData> {
  constructor() {
    super('subscription_overrides');
  }

  /**
   * Get override by user ID
   */
  async getByUser(userId: string): Promise<{ key: string; data: SubscriptionOverrideData } | null> {
    const doc = await this.get(userId);
    return doc || null;
  }

  /**
   * Create or update override for a user
   */
  async upsertOverride(override: SubscriptionOverrideData): Promise<void> {
    await this.create(override.userId, override, override.createdBy);
  }

  /**
   * Remove override for a user
   */
  async removeOverride(userId: string): Promise<void> {
    await this.delete(userId);
  }

  /**
   * Get all active overrides (not expired)
   */
  async getActiveOverrides(): Promise<Array<{ key: string; data: SubscriptionOverrideData; created_at?: bigint; updated_at?: bigint }>> {
    const all = await this.list();
    const now = Date.now();
    return all.filter(override => {
      if (!override.data.expiresAt) return true;
      return override.data.expiresAt > now;
    });
  }

  /**
   * Get expired overrides
   */
  async getExpiredOverrides(): Promise<Array<{ key: string; data: SubscriptionOverrideData; created_at?: bigint; updated_at?: bigint }>> {
    const all = await this.list();
    const now = Date.now();
    return all.filter(override => {
      if (!override.data.expiresAt) return false;
      return override.data.expiresAt <= now;
    });
  }
}
