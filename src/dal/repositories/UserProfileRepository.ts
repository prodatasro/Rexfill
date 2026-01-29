import { BaseRepository } from '../core/BaseRepository';
import type { UserProfileData } from '../../types/user-profile';
import type { Doc } from '@junobuild/core';

export class UserProfileRepository extends BaseRepository<UserProfileData> {
  constructor() {
    super('user_profiles');
  }

  /**
   * Get profile by principal (user ID)
   */
  async getByPrincipal(principal: string): Promise<Doc<UserProfileData> | undefined> {
    return this.get(principal);
  }

  /**
   * Create or update user profile
   */
  async upsert(principal: string, data: Partial<UserProfileData>): Promise<Doc<UserProfileData>> {
    const existing = await this.get(principal);
    
    if (existing) {
      return this.update(principal, {
        ...existing.data,
        ...data,
        updatedAt: Date.now()
      }, existing.version);
    }

    const newProfile: UserProfileData = {
      displayName: data.displayName || '',
      email: data.email,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      preferences: data.preferences || {
        language: 'en',
        theme: 'system'
      },
      isAdmin: data.isAdmin || false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return this.create(principal, newProfile, principal);
  }

  /**
   * Update profile timestamp
   */
  async updateLastActivity(principal: string): Promise<Doc<UserProfileData>> {
    const profile = await this.getOrThrow(principal);
    return this.update(principal, {
      ...profile.data,
      updatedAt: Date.now()
    }, profile.version);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    principal: string,
    preferences: Partial<UserProfileData['preferences']>
  ): Promise<Doc<UserProfileData>> {
    const profile = await this.getOrThrow(principal);
    return this.update(principal, {
      ...profile.data,
      preferences: {
        ...profile.data.preferences,
        ...preferences
      },
      updatedAt: Date.now()
    }, profile.version);
  }

  /**
   * Update avatar URL
   */
  async updateAvatar(principal: string, avatarUrl: string | undefined): Promise<Doc<UserProfileData>> {
    const profile = await this.getOrThrow(principal);
    return this.update(principal, {
      ...profile.data,
      avatarUrl,
      updatedAt: Date.now()
    }, profile.version);
  }

  /**
   * Check if user is admin
   */
  async isAdmin(principal: string): Promise<boolean> {
    const profile = await this.get(principal);
    return profile?.data.isAdmin === true;
  }

  /**
   * Get all admin users
   */
  async getAdmins(): Promise<Array<Doc<UserProfileData>>> {
    const profiles = await this.list();
    return profiles.filter(p => p.data.isAdmin === true);
  }
}
