import { uploadFile, deleteAsset, listAssets } from '@junobuild/core';
import type { IStorage } from '../core/types';
import { RepositoryError, TimeoutError } from '../core/errors';

const UPLOAD_TIMEOUT = 120000; // 120 seconds for file uploads

/**
 * Template storage handler for managing DOCX files
 */
export class TemplateStorage implements IStorage {
  private readonly collectionName = 'templates';

  /**
   * Upload template file with retry logic and progress tracking
   */
  async upload(
    path: string,
    file: File | Blob,
    _onProgress?: (progress: number) => void
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.uploadWithTimeout(path, file, _onProgress);
        return;
      } catch (error) {
        attempt++;
        
        if (attempt >= maxRetries) {
          throw new RepositoryError(
            `Failed to upload template after ${maxRetries} attempts`,
            'UPLOAD_FAILED',
            error
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Upload with timeout protection
   */
  private async uploadWithTimeout(
    path: string,
    file: File | Blob,
    _onProgress?: (progress: number) => void
  ): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError('template upload', UPLOAD_TIMEOUT)),
        UPLOAD_TIMEOUT
      )
    );

    const uploadPromise = uploadFile({
      collection: this.collectionName,
      data: file as File,
      filename: path
    });

    try {
      await Promise.race([uploadPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to upload template file',
        'UPLOAD_FAILED',
        error
      );
    }
  }

  /**
   * Delete template file
   */
  async delete(path: string): Promise<void> {
    try {
      await deleteAsset({
        collection: this.collectionName,
        fullPath: `/${this.collectionName}/${path}`
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to delete template file: ${path}`,
        'DELETE_FAILED',
        error
      );
    }
  }

  /**
   * List template files
   */
  async list(options?: {
    owner?: string;
    startAfter?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const result = await listAssets({
        collection: this.collectionName,
        filter: {
          ...(options?.owner && { owner: options.owner }),
          ...(options?.startAfter && {
            paginate: {
              startAfter: options.startAfter,
              limit: options.limit
            }
          })
        }
      });

      return result.items;
    } catch (error) {
      throw new RepositoryError(
        'Failed to list template files',
        'LIST_FAILED',
        error
      );
    }
  }

  /**
   * Check if template file exists
   */
  async exists(path: string, owner?: string): Promise<boolean> {
    try {
      const files = await this.list({ owner });
      const fullPath = `/${this.collectionName}/${path}`;
      return files.some(f => f.fullPath === fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Get file size for a template
   */
  async getFileSize(path: string, owner?: string): Promise<number | undefined> {
    try {
      const files = await this.list({ owner });
      const fullPath = `/${this.collectionName}/${path}`;
      const file = files.find(f => f.fullPath === fullPath);
      return file?.encodingType?.[0]?.[1];
    } catch {
      return undefined;
    }
  }
}
