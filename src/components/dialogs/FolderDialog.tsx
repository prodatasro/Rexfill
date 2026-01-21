import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Folder } from '../../types/folder';
import { validateFolderName } from '../../utils/folderUtils';

interface FolderDialogProps {
  mode: 'create' | 'rename';
  isOpen: boolean;
  parentFolder: Folder | null;
  existingFolder: Folder | null;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}

const FolderDialog: FC<FolderDialogProps> = ({
  mode,
  isOpen,
  parentFolder,
  existingFolder,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize folder name when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFolderName(mode === 'rename' && existingFolder ? existingFolder.data.name : '');
      setValidationError(null);
    }
  }, [isOpen, mode, existingFolder]);

  // Validate folder name in real-time
  useEffect(() => {
    const validate = async () => {
      if (!folderName.trim()) {
        setValidationError(null);
        return;
      }

      const parentId = mode === 'create'
        ? (parentFolder?.key ?? null)
        : (existingFolder?.data.parentId ?? null);

      const excludeFolderId = mode === 'rename' ? existingFolder?.key : undefined;

      const error = await validateFolderName(folderName, parentId, excludeFolderId);
      setValidationError(error);
    };

    const timeoutId = setTimeout(validate, 300);
    return () => clearTimeout(timeoutId);
  }, [folderName, mode, parentFolder, existingFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setValidationError(t('folders.folderNameEmpty') || 'Folder name cannot be empty');
      return;
    }

    if (validationError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(folderName.trim());
      setFolderName('');
    } catch (error) {
      console.error('Error in folder dialog:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFolderName('');
    setValidationError(null);
    onCancel();
  };

  if (!isOpen) return null;

  const title = mode === 'create'
    ? (parentFolder ? t('folders.createSubfolder') : t('folders.createFolder'))
    : t('folders.renameFolder');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {title}
        </h3>

        <form onSubmit={handleSubmit}>
          {parentFolder && (
            <div className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {t('folders.parentFolder')}: <span className="font-semibold">{parentFolder.data.name}</span>
            </div>
          )}

          <div className="mb-6">
            <label
              htmlFor="folderName"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              {t('folders.folderName')}
            </label>
            <input
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t('folders.enterFolderName') || 'Enter folder name...'}
              className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
              autoFocus
              disabled={isSubmitting}
              maxLength={50}
            />
            {validationError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {validationError}
              </p>
            )}
            {!validationError && folderName.trim() && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                ✓ Valid folder name
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {folderName.length}/50 characters
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('confirmDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim() || !!validationError}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  {mode === 'create' ? t('folders.creating') : t('folders.renaming')}
                </span>
              ) : (
                mode === 'create' ? t('folders.createFolder') : t('folders.renameFolder')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderDialog;
