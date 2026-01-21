import { FC, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../../types/word-template';

interface TemplateRenameDialogProps {
  isOpen: boolean;
  template: Doc<WordTemplateData> | null;
  existingNames: string[];
  onRename: (newName: string) => Promise<void>;
  onCancel: () => void;
}

const TemplateRenameDialog: FC<TemplateRenameDialogProps> = ({
  isOpen,
  template,
  existingNames,
  onRename,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with current name when dialog opens
  useEffect(() => {
    if (isOpen && template) {
      // Remove .docx extension for editing
      const nameWithoutExt = template.data.name.replace(/\.docx$/i, '');
      setNewName(nameWithoutExt);
      setError(null);
      // Focus input after a short delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, template]);

  const validateName = (name: string): string | null => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return t('templateRename.nameEmpty');
    }

    if (trimmedName.length > 100) {
      return t('templateRename.nameTooLong');
    }

    // Check for invalid characters
    const invalidChars = /[/\\:*?"<>|]/;
    if (invalidChars.test(trimmedName)) {
      return t('templateRename.invalidChars');
    }

    // Check for duplicate name (case-insensitive)
    const fullNewName = `${trimmedName}.docx`;
    const isDuplicate = existingNames.some(
      (existing) =>
        existing.toLowerCase() === fullNewName.toLowerCase() &&
        existing.toLowerCase() !== template?.data.name.toLowerCase()
    );
    if (isDuplicate) {
      return t('templateRename.nameExists');
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateName(newName);
    if (validationError) {
      setError(validationError);
      return;
    }

    const fullNewName = `${newName.trim()}.docx`;

    // Check if name actually changed
    if (fullNewName === template?.data.name) {
      onCancel();
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      await onRename(fullNewName);
      onCancel();
    } catch (err) {
      console.error('Error renaming template:', err);
      setError(t('templateRename.renameFailed'));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleNameChange = (value: string) => {
    setNewName(value);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('templateRename.title')}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {t('templateRename.currentName')}:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-50">
                {template.data.name}
              </span>
            </p>

            <label
              htmlFor="newFileName"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              {t('templateRename.newName')}
            </label>

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                id="newFileName"
                type="text"
                value={newName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isRenaming}
                className={`flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                }`}
                placeholder={t('templateRename.placeholder')}
              />
              <span className="text-slate-500 dark:text-slate-400 font-medium">.docx</span>
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isRenaming}
              className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('confirmDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={isRenaming || !newName.trim()}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {isRenaming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  {t('templateRename.renaming')}
                </span>
              ) : (
                t('templateRename.renameButton')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateRenameDialog;
