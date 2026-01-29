import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts';
import { GDPRExportDialog } from '../dialogs/GDPRExportDialog';
import { deleteTemplates, buildStorageAssetMap } from '../../utils/templateDeletion';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import { templateRepository, folderRepository } from '../../dal';

export const DataManagementSection: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showGDPRDialog, setShowGDPRDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [progress, setProgress] = useState('');

  const handleDeleteAll = async () => {
    if (!user) {
      showErrorToast(t('profile.gdpr.notLoggedIn'));
      return;
    }

    if (deleteConfirmation !== 'DELETE') {
      showErrorToast(t('profile.gdpr.deleteIncomplete'));
      return;
    }

    try {
      setDeleting(true);

      // Step 1: Fetch and delete all templates
      setProgress(t('profile.gdpr.deletingTemplates'));
      const templates = await templateRepository.getByOwner(user.key);

      const storageMap = await buildStorageAssetMap();
      await deleteTemplates(templates, storageMap);

      // Step 2: Fetch and delete all folders
      setProgress(t('profile.gdpr.deletingFolders'));
      const folders = await folderRepository.list();

      for (const folder of folders) {
        try {
          await folderRepository.delete(folder.key);
        } catch (error) {
          console.error(`Failed to delete folder ${folder.key}:`, error);
        }
      }

      showSuccessToast(t('profile.gdpr.deleteSuccess'));
      setDeleteConfirmation('');
    } catch (error) {
      console.error('Data deletion failed:', error);
      showErrorToast(t('profile.gdpr.deleteFailed'));
    } finally {
      setDeleting(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t('profile.nav.data')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {t('profile.data.subtitle')}
        </p>
      </div>

      {/* GDPR Data Export */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.gdpr.title')}
        </h3>
        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('profile.gdpr.description')}
          </p>
          <button
            onClick={() => setShowGDPRDialog(true)}
            disabled={deleting}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            <Download size={20} />
            {t('profile.gdpr.export')}
          </button>
        </div>
      </div>

      {/* Delete All Data */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.gdpr.deleteTitle')}
        </h3>
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('profile.gdpr.deleteDescription')}
          </p>

          {/* Progress indicator */}
          {deleting && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center gap-3">
                <LoadingSpinner />
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    {t('profile.gdpr.deleting')}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{progress}</p>
                </div>
              </div>
            </div>
          )}

          {/* Warning and confirmation */}
          {!deleting && (
            <>
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1">{t('profile.gdpr.deleteWarning')}</p>
                  <p>{t('profile.gdpr.deleteExplanation')}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
                    {t('profile.gdpr.deleteConfirm')}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={t('profile.gdpr.deleteConfirmPlaceholder')}
                    className="w-full px-3 py-2 border-2 border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-red-500"
                  />
                </div>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleteConfirmation !== 'DELETE'}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                >
                  <Trash2 size={20} />
                  {t('profile.gdpr.deleteAll')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <GDPRExportDialog isOpen={showGDPRDialog} onClose={() => setShowGDPRDialog(false)} />
    </div>
  );
};
