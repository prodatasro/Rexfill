import { BaseRepository } from '../core/BaseRepository';
import type { WordTemplateData } from '../../types/word-template';
import type { Doc } from '@junobuild/core';

export class TemplateRepository extends BaseRepository<WordTemplateData> {
  constructor() {
    super('templates_meta');
  }

  /**
   * Get templates for a specific user
   */
  async getByOwner(owner: string, folderId?: string): Promise<Array<Doc<WordTemplateData>>> {
    const templates = await this.list({ owner });
    
    if (folderId !== undefined) {
      return templates.filter(t => t.data.folderId === folderId);
    }
    
    return templates;
  }

  /**
   * Get templates in a specific folder
   */
  async getByFolder(folderId: string | null, owner: string): Promise<Array<Doc<WordTemplateData>>> {
    const templates = await this.getByOwner(owner);
    return templates.filter(t => t.data.folderId === folderId);
  }

  /**
   * Search templates by name
   */
  async search(query: string, owner: string): Promise<Array<Doc<WordTemplateData>>> {
    const templates = await this.getByOwner(owner);
    const lowerQuery = query.toLowerCase();
    
    return templates.filter(t => 
      t.data.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get favorite templates
   */
  async getFavorites(owner: string): Promise<Array<Doc<WordTemplateData>>> {
    const templates = await this.getByOwner(owner);
    return templates.filter(t => t.data.isFavorite === true);
  }

  /**
   * Get recently used templates
   */
  async getRecentlyUsed(owner: string, limit: number = 5): Promise<Array<Doc<WordTemplateData>>> {
    const templates = await this.getByOwner(owner);
    
    // Sort by uploadedAt since lastUsedAt doesn't exist in WordTemplateData
    return templates
      .sort((a, b) => b.data.uploadedAt - a.data.uploadedAt)
      .slice(0, limit);
  }

  /**
   * Update template usage timestamp (updates uploadedAt)
   */
  async updateLastUsed(key: string): Promise<Doc<WordTemplateData>> {
    const template = await this.getOrThrow(key);
    return this.update(key, {
      ...template.data,
      uploadedAt: Date.now()
    }, template.version);
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(key: string): Promise<Doc<WordTemplateData>> {
    const template = await this.getOrThrow(key);
    return this.update(key, {
      ...template.data,
      isFavorite: !template.data.isFavorite
    }, template.version);
  }

  /**
   * Move template to a different folder
   */
  async moveToFolder(key: string, folderId: string | null): Promise<Doc<WordTemplateData>> {
    const template = await this.getOrThrow(key);
    return this.update(key, {
      ...template.data,
      folderId
    }, template.version);
  }

  /**
   * Batch move templates to a folder
   */
  async batchMoveToFolder(keys: string[], folderId: string | null): Promise<void> {
    await Promise.all(
      keys.map(key => this.moveToFolder(key, folderId))
    );
  }

  /**
   * Delete all templates in a folder
   */
  async deleteByFolder(folderId: string, owner: string): Promise<void> {
    const templates = await this.getByFolder(folderId, owner);
    await Promise.all(
      templates.map(t => this.delete(t.key))
    );
  }
}
