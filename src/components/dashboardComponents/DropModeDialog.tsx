import { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface DropModeDialogProps {
  files: File[];
  folderName: string;
  onSelectMode: (mode: 'save' | 'saveAndProcess' | 'oneTime') => void;
  onCancel: () => void;
}

const DropModeDialog: FC<DropModeDialogProps> = ({
  files,
  folderName,
  onSelectMode,
  onCancel,
}) => {
  const { t } = useTranslation();

  if (files.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 sm:p-8 relative">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('fileUpload.uploadModeTitle')}
        </h3>

        {/* Show dropped files */}
        <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t('fileUpload.selectedFiles', { count: files.length })}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {files.map((file, index) => (
              <div key={index} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                • {file.name}
              </div>
            ))}
          </div>
        </div>

        {/* Current folder info */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {t('fileUpload.uploadToFolder')}: <span className="font-semibold">{folderName}</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => onSelectMode('save')}
            className="w-full text-left p-4 rounded-xl border-2 border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 shrink-0 text-purple-600 dark:text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {t('fileUpload.saveOnly')}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {t('fileUpload.saveOnlyDesc')}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelectMode('saveAndProcess')}
            disabled={files.length > 1}
            className="w-full text-left p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 shrink-0 text-blue-600 dark:text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {t('fileUpload.saveAndProcess')}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {t('fileUpload.saveAndProcessDesc')}
                </div>
                {files.length > 1 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {t('fileUpload.singleFileOnly')}
                  </div>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelectMode('oneTime')}
            disabled={files.length > 1}
            className="w-full text-left p-4 rounded-xl border-2 border-green-300 dark:border-green-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 shrink-0 text-green-600 dark:text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {t('fileUpload.oneTimeProcess')}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {t('fileUpload.oneTimeProcessDesc')}
                </div>
                {files.length > 1 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {t('fileUpload.singleFileOnly')}
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all"
        >
          {t('fileUpload.cancelUpload')}
        </button>
      </div>
    </div>
  );
};

export default DropModeDialog;
