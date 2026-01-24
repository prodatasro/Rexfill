import type { Doc } from '@junobuild/core';

/**
 * User profile data structure
 */
export interface UserProfileData {
  /** User's display name */
  displayName: string;
  
  /** User's email address (optional) */
  email?: string;
  
  /** URL to user's avatar image in Juno storage */
  avatarUrl?: string;
  
  /** User's bio or description */
  bio?: string;
  
  /** User preferences */
  preferences: {
    /** Default folder for new templates */
    defaultFolder?: string | null;
    
    /** Preferred language */
    language?: string;
    
    /** Theme preference */
    theme?: 'light' | 'dark' | 'system';
  };
  
  /** Timestamp when profile was created */
  createdAt: number;
  
  /** Timestamp when profile was last updated */
  updatedAt: number;
}

/**
 * User profile document type
 */
export type UserProfile = Doc<UserProfileData>;
