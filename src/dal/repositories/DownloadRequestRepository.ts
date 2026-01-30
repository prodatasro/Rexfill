import { BaseRepository } from '../core/BaseRepository';
import type { Doc } from '@junobuild/core';

export interface DownloadRequestData {
  requestType: 'download' | 'export';
  status: 'pending' | 'approved' | 'rejected';
  templateIds: string[];
  approvedTemplateIds?: string[];
  createdAt: number;
  error?: {
    code: string;
    message: string;
    limit?: number;
    used?: number;
    requested?: number;
    retryAfterSeconds?: number;
  };
}

export class DownloadRequestRepository extends BaseRepository<DownloadRequestData> {
  constructor() {
    super('download_requests');
  }

  /**
   * Create a download request with a unique key
   */
  async createRequest(
    userKey: string,
    requestType: 'download' | 'export',
    templateIds: string[]
  ): Promise<{ key: string; doc: Doc<DownloadRequestData> }> {
    const timestamp = Date.now();
    const key = `${userKey}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
    
    const doc = await this.create(key, {
      requestType,
      status: 'pending',
      templateIds,
      createdAt: timestamp
    }, userKey);

    return { key, doc };
  }

  /**
   * Poll for request status until it's no longer pending
   * Returns the updated document or null if timeout
   */
  async pollForStatus(
    key: string,
    timeoutMs: number = 30000,
    intervalMs: number = 500
  ): Promise<Doc<DownloadRequestData> | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
      const doc = await this.get(key);
      
      if (doc && doc.data.status !== 'pending') {
        return doc;
      }
    }

    return null; // Timeout
  }

  /**
   * Check if request was approved
   */
  isApproved(doc: Doc<DownloadRequestData>): boolean {
    return doc.data.status === 'approved';
  }

  /**
   * Check if request was rejected
   */
  isRejected(doc: Doc<DownloadRequestData>): boolean {
    return doc.data.status === 'rejected';
  }

  /**
   * Get approved template IDs from a request
   */
  getApprovedTemplateIds(doc: Doc<DownloadRequestData>): string[] {
    return doc.data.approvedTemplateIds || doc.data.templateIds;
  }

  /**
   * Delete request with retry logic
   */
  async deleteWithRetry(key: string, maxAttempts: number = 3): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.delete(key);
        return true;
      } catch (error) {
        console.warn(`Failed to delete request document (attempt ${attempt + 1}/${maxAttempts}):`, error);
        if (attempt < maxAttempts - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return false;
  }
}
