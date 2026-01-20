import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Crown, Zap, Sparkles, Building2 } from 'lucide-react';

interface SubscriptionBadgeProps {
  showLabel?: boolean;
}

const SubscriptionBadge: FC<SubscriptionBadgeProps> = ({ showLabel = true }) => {
  const { t } = useTranslation();
  const { plan } = useSubscription();

  const getPlanIcon = () => {
    switch (plan.id) {
      case 'enterprise':
        return <Building2 className="w-4 h-4" />;
      case 'professional':
        return <Crown className="w-4 h-4" />;
      case 'starter':
        return <Zap className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getPlanStyles = () => {
    switch (plan.id) {
      case 'enterprise':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'professional':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'starter':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPlanStyles()}`}
    >
      {getPlanIcon()}
      {showLabel && <span>{t(`pricing.plans.${plan.id}.name`)}</span>}
    </div>
  );
};

export default SubscriptionBadge;
