import { FC } from 'react';
import { CheckCircle, XCircle, Loader2, Clock, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FileStatusInfo } from '../../types/multi-processing';

interface BatchStatusPanelProps {
  fileStatuses: FileStatusInfo[];
  onRetryFailed: () => void;
  onDismiss: () => void;
  isProcessing: boolean;
}

export const BatchStatusPanel: FC<BatchStatusPanelProps> = ({
  fileStatuses,
  onRetryFailed,
  onDismiss,
  isProcessing,
}) => {
  const { t } = useTranslation();

  if (fileStatuses.length === 0) return null;

  const successCount = fileStatuses.filter(s => s.status === 'success').length;
  const errorCount = fileStatuses.filter(s => s.status === 'error').length;
  const pendingCount = fileStatuses.filter(s => s.status === 'pending').length;
  const processingCount = fileStatuses.filter(s => s.status === 'processing').length;

  // Only show panel if there are errors or processing is ongoing
  const hasErrors = errorCount > 0;
  const isActive = isProcessing || pendingCount > 0 || processingCount > 0;

  if (!hasErrors && !isActive) return null;

  const getStatusIcon = (status: FileStatusInfo['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: FileStatusInfo['status']) => {
    switch (status) {
      case 'pending':
        return t('templateProcessor.batchStatus.pending');
      case 'processing':
        return t('templateProcessor.batchStatus.processing');
      case 'success':
        return t('templateProcessor.batchStatus.success');
      case 'error':
        return t('templateProcessor.batchStatus.error');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
          {t('templateProcessor.batchStatus.title')}
        </h4>
        <div className="flex items-center gap-2">
          {hasErrors && !isProcessing && (
            <button
              onClick={onRetryFailed}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('templateProcessor.batchStatus.retryFailed')}
            </button>
          )}
          {!isActive && (
            <button
              onClick={onDismiss}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={t('templateProcessor.batchStatus.dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        {successCount > 0 && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            {successCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            {errorCount}
          </span>
        )}
        {(pendingCount > 0 || processingCount > 0) && (
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {pendingCount + processingCount}
          </span>
        )}
      </div>

      {/* File list - only show files with errors or currently processing */}
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {fileStatuses
          .filter(s => s.status === 'error' || s.status === 'processing')
          .map((fileStatus) => (
            <div
              key={fileStatus.id}
              className={`flex items-start gap-2 p-2 rounded-md ${
                fileStatus.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              {getStatusIcon(fileStatus.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {fileStatus.fileName}
                  </span>
                  <span className={`text-xs ${
                    fileStatus.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {getStatusText(fileStatus.status)}
                  </span>
                </div>
                {fileStatus.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate" title={fileStatus.error}>
                    {fileStatus.error}
                  </p>
                )}
                {fileStatus.retryCount && fileStatus.retryCount > 1 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Retry #{fileStatus.retryCount - 1}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
