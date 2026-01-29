import { uploadFile, deleteAsset, listAssets } from '@junobuild/core';
import type { IStorage } from '../core/types';
import { RepositoryError, TimeoutError, ValidationError } from '../core/errors';

const UPLOAD_TIMEOUT = 60000; // 60 seconds for avatar uploads
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Avatar storage handler for user profile images
 */
export class AvatarStorage implements IStorage {
  private readonly collectionName = 'user_avatars';

  /**
   * Validate avatar file before upload
   */
  private validateAvatar(file: File | Blob): void {
    if (file.size > MAX_AVATAR_SIZE) {
      throw new ValidationError(
        `Avatar file size must be less than ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
        'file'
      );
    }

    if (file instanceof File && !ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError(
        `Avatar must be one of: ${ALLOWED_TYPES.join(', ')}`,
        'file'
      );
    }
  }

  /**
   * Upload avatar with validation and progress tracking
   */
  async upload(
    path: string,
    file: File | Blob,
    _onProgress?: (progress: number) => void
  ): Promise<void> {
    this.validateAvatar(file);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError('avatar upload', UPLOAD_TIMEOUT)),
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
      if (error instanceof TimeoutError || error instanceof ValidationError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to upload avatar',
        'UPLOAD_FAILED',
        error
      );
    }
  }

  /**
   * Delete avatar file
   */
  async delete(path: string): Promise<void> {
    try {
      await deleteAsset({
        collection: this.collectionName,
        fullPath: `/${this.collectionName}/${path}`
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to delete avatar: ${path}`,
        'DELETE_FAILED',
        error
      );
    }
  }

  /**
   * List avatar files
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
        'Failed to list avatars',
        'LIST_FAILED',
        error
      );
    }
  }

  /**
   * Delete old avatar and upload new one
   */
  async replace(
    oldPath: string | undefined,
    newPath: string,
    file: File | Blob,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Upload new avatar first
    await this.upload(newPath, file, onProgress);

    // Delete old avatar if it exists and is different
    if (oldPath && oldPath !== newPath) {
      try {
        await this.delete(oldPath);
      } catch {
        // Ignore deletion errors for old avatar
      }
    }
  }
}
