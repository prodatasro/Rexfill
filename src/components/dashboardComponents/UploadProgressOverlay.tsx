import { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface UploadProgress {
  currentFile: number;
  totalFiles: number;
  currentFileName: string;
  status: 'preparing' | 'uploading' | 'saving';
}

interface UploadProgressOverlayProps {
  progress: UploadProgress | null;
}

const UploadProgressOverlay: FC<UploadProgressOverlayProps> = ({ progress }) => {
  const { t } = useTranslation();

  if (!progress) return null;

  return (
    <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600 dark:text-purple-400" />
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t('fileUpload.uploading')}
        </p>

        <div className="w-full space-y-2">
          {/* Progress bar */}
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.currentFile / progress.totalFiles) * 100}%` }}
            />
          </div>

          {/* File counter */}
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              {t('fileUpload.uploadProgress', {
                current: progress.currentFile,
                total: progress.totalFiles
              })}
            </span>
            <span>
              {progress.status === 'preparing' && t('fileUpload.statusPreparing')}
              {progress.status === 'uploading' && t('fileUpload.statusUploading')}
              {progress.status === 'saving' && t('fileUpload.statusSaving')}
            </span>
          </div>

          {/* Current file name */}
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate text-center">
            {progress.currentFileName}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadProgressOverlay;
