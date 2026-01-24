import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts';
import SubscriptionBadge from '../billing/SubscriptionBadge';
import { GDPRExportDialog } from '../dialogs/GDPRExportDialog';
import { listDocsWithTimeout, deleteDocWithTimeout } from '../../utils/junoWithTimeout';
import { deleteTemplates, buildStorageAssetMap } from '../../utils/templateDeletion';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import type { WordTemplateData, Folder } from '../../types';
import type { Doc } from '@junobuild/core';

export const SubscriptionSection: FC = () => {
  const { t } = useTranslation();
  const { plan, usage } = useSubscription();
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
      const templatesResult = await listDocsWithTimeout<WordTemplateData>({
        collection: 'templates_meta',
      });
      const templates = templatesResult.items;

      const storageMap = await buildStorageAssetMap();
      await deleteTemplates(templates, storageMap);

      // Step 2: Fetch and delete all folders
      setProgress(t('profile.gdpr.deletingFolders'));
      const foldersResult = await listDocsWithTimeout({
        collection: 'folders',
      });
      const folders = foldersResult.items as Doc<Folder>[];

      for (const folder of folders) {
        try {
          await deleteDocWithTimeout({
            collection: 'folders',
            doc: folder,
          });
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
          {t('profile.nav.subscription')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {t('profile.subscription.subtitle')}
        </p>
      </div>

      {/* Current Plan */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.subscription.currentPlan')}
        </h3>
        <div className="p-6 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
          <SubscriptionBadge />
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {t(`profile.subscription.planDescription.${plan.id}`)}
          </p>
        </div>
      </div>

      {/* Usage Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.subscription.usage')}
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{t('profile.subscription.documentsToday')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {usage.documentsToday} / {plan.limits.documentsPerDay === -1 ? '∞' : plan.limits.documentsPerDay}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{t('profile.subscription.documentsThisMonth')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {usage.documentsThisMonth} / {plan.limits.documentsPerMonth === -1 ? '∞' : plan.limits.documentsPerMonth}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{t('profile.subscription.totalTemplates')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {usage.totalTemplates} / {plan.limits.maxTemplates === -1 ? '∞' : plan.limits.maxTemplates}
                </span>
              </div>
            </div>
          </div>
        </div>
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
