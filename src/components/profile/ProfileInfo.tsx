import { FC, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Upload, Trash2, Save } from 'lucide-react';
import { useUserProfile } from '../../contexts/UserProfileContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast } from '../../utils/toast';

export const ProfileInfo: FC = () => {
  const { t } = useTranslation();
  const { profile, updateProfile, uploadAvatar, removeAvatar } = useUserProfile();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.data.displayName || '');
      setEmail(profile.data.email || '');
      setBio(profile.data.bio || '');
    }
  }, [profile]);

  const handleEditClick = () => {
    if (profile) {
      setDisplayName(profile.data.displayName || '');
      setEmail(profile.data.email || '');
      setBio(profile.data.bio || '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        displayName,
        email: email || undefined,
        bio: bio || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setDisplayName(profile.data.displayName || '');
      setEmail(profile.data.email || '');
      setBio(profile.data.bio || '');
    }
    setIsEditing(false);
    setAvatarPreview(null);
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showErrorToast(t('profile.avatar.invalidFileType'));
      return;
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showErrorToast(t('profile.avatar.fileTooLarge'));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      setUploading(true);
      await uploadAvatar(file);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setUploading(true);
      await removeAvatar();
    } catch (error) {
      console.error('Failed to remove avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const avatarUrl = avatarPreview || profile.data.avatarUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {t('profile.nav.profile')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('profile.profileInfo.subtitle')}
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            {t('profile.editProfile')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar section */}
        <div className="flex flex-col items-center">
          <div
            ref={dropZoneRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative mb-4"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-4 border-slate-300 dark:border-slate-600">
                <User size={48} className="text-slate-400 dark:text-slate-500" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <LoadingSpinner />
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
              {t('profile.avatar.upload')}
            </button>
            
            {profile.data.avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
            {t('profile.avatar.maxSize')}
          </p>
        </div>

        {/* Profile fields */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.displayName')}
            </label>
            {isEditing ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('profile.displayNamePlaceholder')}
                className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <p className="px-4 py-3 text-slate-900 dark:text-slate-50">
                {profile.data.displayName || t('profile.notSet')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.email')}
            </label>
            {isEditing ? (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('profile.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500"
                />
              </div>
            ) : (
              <p className="px-4 py-3 text-slate-900 dark:text-slate-50">
                {profile.data.email || t('profile.notSet')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.bio')}
            </label>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('profile.bioPlaceholder')}
                rows={3}
                className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500 resize-none"
              />
            ) : (
              <p className="px-4 py-3 text-slate-900 dark:text-slate-50 whitespace-pre-wrap">
                {profile.data.bio || t('profile.notSet')}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                <Save size={16} />
                {t('profile.save')}
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors"
              >
                {t('profile.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
