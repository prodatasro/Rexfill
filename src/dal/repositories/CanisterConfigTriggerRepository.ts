import { BaseRepository } from '../core/BaseRepository';

export interface CanisterConfigTriggerData {
  action: string;
  timestamp: number;
  triggeredBy: string;
  hasProdKey?: boolean;
  hasDevKey?: boolean;
  hasProdWebhook?: boolean;
  hasDevWebhook?: boolean;
}

/**
 * Repository for managing canister configuration triggers
 */
export class CanisterConfigTriggerRepository extends BaseRepository<CanisterConfigTriggerData> {
  constructor() {
    super('canister_config_triggers');
  }

  /**
   * Create a configuration trigger
   */
  async createTrigger(
    action: string,
    triggeredBy: string,
    metadata?: {
      hasProdKey?: boolean;
      hasDevKey?: boolean;
      hasProdWebhook?: boolean;
      hasDevWebhook?: boolean;
    }
  ): Promise<string> {
    const triggerId = `config_${Date.now()}`;
    const data: CanisterConfigTriggerData = {
      action,
      timestamp: Date.now(),
      triggeredBy,
      ...metadata,
    };

    await this.create(triggerId, data, triggeredBy);
    return triggerId;
  }
}
