import { FC } from 'react';
import { Link } from 'react-router-dom';
import { X, Zap, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';

const UpgradePrompt: FC = () => {
  const { t } = useTranslation();
  const { upgradePromptVisible, hideUpgradePrompt, plan, checkLimits } = useSubscription();

  const { message } = checkLimits();

  if (!upgradePromptVisible) return null;

  // Don't show for paid plans with plenty of usage
  if (plan.id !== 'free' && !message) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-linear-to-r from-primary-600 to-primary-700 rounded-xl shadow-xl p-4 text-white">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{t('subscription.upgrade.title')}</h3>
          </div>
          <button
            onClick={hideUpgradePrompt}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-primary-100 text-sm mb-4">
          {message ? t(message) : t('subscription.upgrade.nearLimit')}
        </p>

        <Link
          to="/pricing"
          onClick={hideUpgradePrompt}
          className="flex items-center justify-center gap-2 w-full bg-white text-primary-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-primary-50 transition-colors"
        >
          {t('subscription.upgrade.upgradeNow')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default UpgradePrompt;
