import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { isUnlimited } from '../../config/plans';

interface UsageMeterProps {
  compact?: boolean;
}

const UsageMeter: FC<UsageMeterProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { plan, usage } = useSubscription();

  const dailyLimit = plan.limits.documentsPerDay;
  const isUnlimitedDaily = isUnlimited(dailyLimit);

  const usedToday = usage.documentsToday;
  const percentage = isUnlimitedDaily ? 0 : Math.min((usedToday / dailyLimit) * 100, 100);

  // Color based on usage percentage
  const getBarColor = () => {
    if (isUnlimitedDaily) return 'bg-green-500';
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-primary-500';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: isUnlimitedDaily ? '100%' : `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {isUnlimitedDaily
            ? t('subscription.usage.unlimited')
            : `${usedToday}/${dailyLimit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-600 dark:text-slate-400">
          {t('subscription.usage.title')}
        </span>
        <span className="font-medium text-slate-900 dark:text-white">
          {isUnlimitedDaily
            ? t('subscription.usage.unlimited')
            : t('subscription.usage.documentsProcessed', {
                used: usedToday,
                limit: dailyLimit,
              })}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: isUnlimitedDaily ? '100%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default UsageMeter;
