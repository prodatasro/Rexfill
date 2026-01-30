import { BaseRepository } from '../core/BaseRepository';

export interface WebhookHistoryData {
  eventType: string;
  receivedAt: number;
  processed: boolean;
  error?: string;
  payload?: Record<string, any>;
}

/**
 * Repository for managing webhook history
 */
export class WebhookHistoryRepository extends BaseRepository<WebhookHistoryData> {
  constructor() {
    super('webhook_history');
  }

  /**
   * List all webhook events sorted by received time (newest first)
   */
  async listAllSorted(): Promise<Array<{ key: string; data: WebhookHistoryData; created_at?: bigint; updated_at?: bigint }>> {
    const docs = await this.list();
    return docs.sort((a, b) => b.data.receivedAt - a.data.receivedAt);
  }

  /**
   * Get successful webhooks
   */
  async getSuccessful(): Promise<Array<{ key: string; data: WebhookHistoryData; created_at?: bigint; updated_at?: bigint }>> {
    const allWebhooks = await this.listAllSorted();
    return allWebhooks.filter(webhook => webhook.data.processed);
  }

  /**
   * Get failed webhooks
   */
  async getFailed(): Promise<Array<{ key: string; data: WebhookHistoryData; created_at?: bigint; updated_at?: bigint }>> {
    const allWebhooks = await this.listAllSorted();
    return allWebhooks.filter(webhook => !webhook.data.processed);
  }

  /**
   * Get webhooks by event type
   */
  async getByEventType(eventType: string): Promise<Array<{ key: string; data: WebhookHistoryData; created_at?: bigint; updated_at?: bigint }>> {
    const allWebhooks = await this.listAllSorted();
    return allWebhooks.filter(webhook => webhook.data.eventType === eventType);
  }

  /**
   * Get webhooks within a time range
   */
  async getByTimeRange(startTime: number, endTime?: number): Promise<Array<{ key: string; data: WebhookHistoryData; created_at?: bigint; updated_at?: bigint }>> {
    const allWebhooks = await this.listAllSorted();
    return allWebhooks.filter(webhook => {
      if (webhook.data.receivedAt < startTime) return false;
      if (endTime && webhook.data.receivedAt > endTime) return false;
      return true;
    });
  }
}
