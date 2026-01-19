import { FC } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DragDropOverlay: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 backdrop-blur-sm rounded-lg flex items-center justify-center z-50 border-4 border-dashed border-blue-500 dark:border-blue-400 pointer-events-none">
      <div className="flex flex-col items-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <Upload className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t('fileUpload.dropFilesHere')}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('fileUpload.dropFilesHint')}
        </p>
      </div>
    </div>
  );
};

export default DragDropOverlay;
