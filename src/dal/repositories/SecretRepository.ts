import { BaseRepository } from '../core/BaseRepository';

export interface SecretData {
  value: string;
  description: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Repository for managing platform secrets (API keys, webhook secrets, etc.)
 */
export class SecretRepository extends BaseRepository<SecretData> {
  constructor() {
    super('secrets');
  }

  /**
   * Create or update a secret
   */
  async upsertSecret(key: string, value: string, description: string, createdBy: string, version?: bigint): Promise<void> {
    const data: SecretData = {
      value,
      description,
      createdAt: Date.now(),
      createdBy,
    };

    if (version !== undefined) {
      // Update existing secret with version check
      await this.update(key, data, version);
    } else {
      // Create new secret
      await this.create(key, data, createdBy);
    }
  }

  /**
   * Get a secret by key
   */
  async getSecret(key: string): Promise<{ key: string; data: SecretData; version?: bigint } | null> {
    const doc = await this.get(key);
    return doc || null;
  }

  /**
   * List all secrets
   */
  async listAllSecrets(): Promise<Array<{ key: string; data: SecretData; created_at?: bigint; updated_at?: bigint; version?: bigint }>> {
    return this.list();
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<void> {
    await this.delete(key);
  }
}
