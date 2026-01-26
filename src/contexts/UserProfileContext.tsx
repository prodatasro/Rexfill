import { createContext, useContext, useEffect, useState, ReactNode, FC, useCallback } from 'react';
import { uploadFile } from '@junobuild/core';
import { useAuth } from './AuthContext';
import { UserProfile, UserProfileData } from '../types';
import { getDocWithTimeout, setDocWithTimeout } from '../utils/junoWithTimeout';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { logActivity } from '../utils/activityLogger';

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfileData>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
}

/**
 * Resize and compress an image using Canvas API
 * @param file - Original image file
 * @param maxSize - Maximum dimension (width/height) in pixels
 * @param quality - JPEG quality (0-1)
 * @returns Compressed image blob
 */
const compressImage = async (file: File, maxSize: number = 256, quality: number = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const UserProfileProvider: FC<UserProfileProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const doc = await getDocWithTimeout<UserProfileData>({
          collection: 'user_profiles',
          key: user.key,
        });
        
        if (doc) {
          setProfile(doc);
        } else {
          // Profile doesn't exist, create default one
          console.log('Creating default profile for user:', user.key);
          const defaultProfile: UserProfile = {
            key: user.key,
            owner: user.key,
            data: {
              displayName: '',
              preferences: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            created_at: BigInt(Date.now() * 1000000),
            updated_at: BigInt(Date.now() * 1000000),
            version: BigInt(1),
          };

          await setDocWithTimeout({
            collection: 'user_profiles',
            doc: defaultProfile,
          });

          setProfile(defaultProfile);

          // Log profile creation
          await logActivity({
            action: 'created',
            resource_type: 'user_profile',
            resource_id: user.key,
            resource_name: 'User Profile',
            created_by: user.key,
            modified_by: user.key,
            success: true,
          });
        }
      } catch (error) {
        console.error('Failed to load/create profile:', error);
        showErrorToast('Failed to initialize user profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const updateProfile = useCallback(
    async (data: Partial<UserProfileData>) => {
      if (!user || !profile) {
        throw new Error('No user or profile loaded');
      }

      try {
        // Fetch the latest version to avoid version conflicts
        const currentDoc = await getDocWithTimeout<UserProfileData>({
          collection: 'user_profiles',
          key: user.key,
        });

        if (!currentDoc) {
          throw new Error('Profile not found');
        }

        const updatedProfile: UserProfile = {
          ...currentDoc,
          data: {
            ...currentDoc.data,
            ...data,
            updatedAt: Date.now(),
          },
        };

        await setDocWithTimeout({
          collection: 'user_profiles',
          doc: updatedProfile,
        });

        setProfile(updatedProfile);
        showSuccessToast('Profile updated successfully');

        // Log profile update
        await logActivity({
          action: 'updated',
          resource_type: 'user_profile',
          resource_id: user.key,
          resource_name: 'User Profile',
          created_by: user.key,
          modified_by: user.key,
          success: true,
        });
      } catch (error) {
        console.error('Failed to update profile:', error);
        showErrorToast('Failed to update profile');
        throw error;
      }
    },
    [user, profile]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user || !profile) {
        throw new Error('No user or profile loaded');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showErrorToast('Please select an image file');
        throw new Error('Invalid file type');
      }

      // Validate file size (max 5MB original)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        showErrorToast('Image too large (max 5MB)');
        throw new Error('File too large');
      }

      try {
        // Compress image
        const compressedBlob = await compressImage(file, 256, 0.85);

        // Upload to Juno storage
        // Convert Blob to File for uploadFile API
        const avatarFile = new File([compressedBlob], 'avatar.jpg', { type: 'image/jpeg' });
        const { downloadUrl } = await uploadFile({
          data: avatarFile,
          collection: 'user_avatars',
          filename: `${user.key}/avatar.jpg`,
        });

        // Update profile with avatar URL
        await updateProfile({ avatarUrl: downloadUrl });
        showSuccessToast('Avatar uploaded successfully');
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        showErrorToast('Failed to upload avatar');
        throw error;
      }
    },
    [user, profile, updateProfile]
  );

  const removeAvatar = useCallback(async () => {
    if (!user || !profile) {
      throw new Error('No user or profile loaded');
    }

    try {
      // Delete from storage
      // Note: deleteDocWithTimeout is for datastore, not storage
      // Avatar deletion from storage would require deleteFile from Juno SDK
      // For now, just update profile to remove URL reference

      // Update profile
      await updateProfile({ avatarUrl: undefined });
      showSuccessToast('Avatar removed successfully');
    } catch (error) {
      console.error('Failed to remove avatar:', error);
      showErrorToast('Failed to remove avatar');
      throw error;
    }
  }, [user, profile, updateProfile]);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        loading,
        updateProfile,
        uploadAvatar,
        removeAvatar,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
