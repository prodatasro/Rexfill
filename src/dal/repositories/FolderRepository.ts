import { BaseRepository } from '../core/BaseRepository';
import type { FolderData } from '../../types/folder';
import type { Doc } from '@junobuild/core';
import { ValidationError } from '../core/errors';

export class FolderRepository extends BaseRepository<FolderData> {
  constructor() {
    super('folders');
  }

  /**
   * Get all folders for a user
   */
  async getByOwner(owner: string): Promise<Array<Doc<FolderData>>> {
    return this.list({ owner });
  }

  /**
   * Get root folders (no parent)
   */
  async getRootFolders(owner: string): Promise<Array<Doc<FolderData>>> {
    const folders = await this.getByOwner(owner);
    return folders.filter(f => !f.data.parentId);
  }

  /**
   * Get subfolders of a parent folder
   */
  async getSubfolders(parentId: string, owner: string): Promise<Array<Doc<FolderData>>> {
    const folders = await this.getByOwner(owner);
    return folders.filter(f => f.data.parentId === parentId);
  }

  /**
   * Check if a folder has subfolders
   */
  async hasSubfolders(folderId: string, owner: string): Promise<boolean> {
    const subfolders = await this.getSubfolders(folderId, owner);
    return subfolders.length > 0;
  }

  /**
   * Validate folder depth (max 2 levels)
   */
  async validateDepth(parentId: string | null): Promise<void> {
    if (!parentId) {
      return; // Root folder, depth 1
    }

    const parent = await this.get(parentId);
    if (!parent) {
      throw new ValidationError('Parent folder not found', 'parentId');
    }

    if (parent.data.parentId) {
      throw new ValidationError('Maximum folder depth (2 levels) exceeded', 'parentId');
    }
  }

  /**
   * Create a folder with depth validation
   */
  async createFolder(
    key: string,
    data: FolderData,
    owner: string
  ): Promise<Doc<FolderData>> {
    await this.validateDepth(data.parentId);
    return this.create(key, data, owner);
  }

  /**
   * Update folder parent with depth validation
   */
  async moveFolder(
    key: string,
    newParentId: string | null
  ): Promise<Doc<FolderData>> {
    await this.validateDepth(newParentId);
    
    const folder = await this.getOrThrow(key);
    return this.update(key, {
      ...folder.data,
      parentId: newParentId
    }, folder.version);
  }

  /**
   * Delete folder and all subfolders recursively
   */
  async deleteRecursive(folderId: string, owner: string): Promise<void> {
    const subfolders = await this.getSubfolders(folderId, owner);
    
    // Delete all subfolders first
    await Promise.all(
      subfolders.map(subfolder => this.delete(subfolder.key))
    );
    
    // Then delete the folder itself
    await this.delete(folderId);
  }

  /**
   * Get folder path (breadcrumb)
   */
  async getFolderPath(folderId: string): Promise<Array<Doc<FolderData>>> {
    const path: Array<Doc<FolderData>> = [];
    let currentFolder = await this.get(folderId);

    while (currentFolder) {
      path.unshift(currentFolder);
      if (currentFolder.data.parentId) {
        currentFolder = await this.get(currentFolder.data.parentId);
      } else {
        break;
      }
    }

    return path;
  }
}
