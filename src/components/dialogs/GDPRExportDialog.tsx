import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { createGDPRExportZip, downloadBlob } from '../../utils/exportImport';
import { fetchAllLogs } from '../../utils/activityLogger';
import { listDocsWithTimeout } from '../../utils/junoWithTimeout';
import type { WordTemplateData, Folder } from '../../types';
import type { Doc } from '@junobuild/core';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

interface GDPRExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GDPRExportDialog: FC<GDPRExportDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { subscriptionData, usageSummary } = useSubscription();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!user) {
      showErrorToast(t('profile.gdpr.notLoggedIn'));
      return;
    }

    try {
      setExporting(true);

      // Step 1: Fetch templates
      setProgress(t('profile.gdpr.fetchingTemplates'));
      const templatesResult = await listDocsWithTimeout<WordTemplateData>({
        collection: 'templates_meta',
      });
      const templates = templatesResult.items;

      // Step 2: Fetch folders
      setProgress(t('profile.gdpr.fetchingFolders'));
      const foldersResult = await listDocsWithTimeout({
        collection: 'folders',
      });
      const folders = foldersResult.items as Folder[];

      // Step 3: Fetch activity logs
      setProgress(t('profile.gdpr.fetchingLogs'));
      const activityLogs = await fetchAllLogs();

      // Step 4: Create ZIP
      setProgress(t('profile.gdpr.creatingArchive'));
      const zip = await createGDPRExportZip(
        profile,
        templates,
        folders,
        activityLogs,
        subscriptionData,
        usageSummary,
        async (template: Doc<WordTemplateData>) => {
          try {
            if (!template.data.url) return null;
            const response = await fetch(template.data.url);
            if (!response.ok) return null;
            return await response.blob();
          } catch (error) {
            console.error(`Failed to fetch template ${template.data.name}:`, error);
            return null;
          }
        }
      );

      // Step 5: Download
      setProgress(t('profile.gdpr.downloading'));
      const timestamp = new Date().toISOString().split('T')[0];
      downloadBlob(zip, `rexfill-gdpr-export-${timestamp}.zip`);

      showSuccessToast(t('profile.gdpr.exportSuccess'));
      onClose();
    } catch (error) {
      console.error('GDPR export failed:', error);
      showErrorToast(t('profile.gdpr.exportFailed'));
    } finally {
      setExporting(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
              {t('profile.gdpr.title')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t('profile.gdpr.subtitle')}
            </p>
          </div>
          {!exporting && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Blockchain disclaimer */}
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">{t('profile.gdpr.blockchainWarning')}</p>
            <p>{t('profile.gdpr.blockchainExplanation')}</p>
          </div>
        </div>

        {/* Data categories */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {t('profile.gdpr.includedData')}
          </h4>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataProfile')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataTemplates')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataFolders')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataLogs')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataSubscription')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {t('profile.gdpr.dataUsage')}
            </li>
          </ul>
        </div>

        {/* Progress indicator */}
        {exporting && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center gap-3">
              <LoadingSpinner />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {t('profile.gdpr.exporting')}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{progress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            <Download size={20} />
            {t('profile.gdpr.export')}
          </button>
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            {t('profile.gdpr.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
