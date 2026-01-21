import { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DeletingOverlay: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-12 h-12 animate-spin text-red-600 dark:text-red-400" />
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t('folders.deleting')}
        </p>
      </div>
    </div>
  );
};

export default DeletingOverlay;
