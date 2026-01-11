import { FC } from 'react';
import { Save, FilePlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  hasTemplate: boolean;
  isLoading?: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export const UnsavedChangesDialog: FC<UnsavedChangesDialogProps> = ({
  isOpen,
  hasTemplate,
  isLoading = false,
  onSave,
  onSaveAs,
  onDiscard,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('templateProcessor.unsavedChangesTitle')}
        </h3>

        <p className="text-slate-600 dark:text-slate-300 mb-6">
          {t('templateProcessor.unsavedChangesMessage')}
        </p>

        <div className="flex flex-col gap-3">
          {hasTemplate && (
            <button
              onClick={() => {
                onClose();
                onSave();
              }}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('templateProcessor.saving')}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {t('templateProcessor.unsavedChangesSave')}
                </>
              )}
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              onSaveAs();
            }}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <FilePlus className="w-5 h-5" />
            {t('templateProcessor.unsavedChangesSaveAs')}
          </button>
          <button
            onClick={() => {
              onClose();
              onDiscard();
            }}
            disabled={isLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all"
          >
            {t('templateProcessor.unsavedChangesDiscard')}
          </button>
        </div>
      </div>
    </div>
  );
};
