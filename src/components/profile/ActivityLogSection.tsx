import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityLogViewer } from './ActivityLogViewer';

export const ActivityLogSection: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t('profile.nav.activity')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {t('profile.activity.subtitle')}
        </p>
      </div>

      <ActivityLogViewer />
    </div>
  );
};
