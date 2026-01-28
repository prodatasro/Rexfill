import { FC, useState, useEffect } from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle, XCircle, ArrowUpRight, Loader2, Building2, AlertTriangle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { SUBSCRIPTION_PLANS, isUnlimited } from '../../config/plans';
import { openCheckout } from '../../lib/paddle';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';

const SubscriptionPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const { plan, subscription, individualSubscription, organizationSubscription, gracePeriodEndsAt, usage, isLoading } = useSubscription();
  const { currentOrganization, exportOrganizationData } = useOrganization();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Handle success parameter from Paddle redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      showSuccessToast(t('subscription.checkoutSuccess') || 'Subscription activated successfully!');
      // Clean up URL
      window.history.replaceState({}, '', '/app/subscription');
    }
  }, [t]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'trialing':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'past_due':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'cancelled':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return <CheckCircle className="w-5 h-5" />;
      case 'past_due':
        return <AlertCircle className="w-5 h-5" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!user) return;

    setUpgradeLoading(true);
    try {
      await openCheckout(
        planId as 'starter' | 'professional' | 'enterprise',
        'monthly',
        {
          customData: {
            userId: user.key,
            upgradeFrom: plan.id,
          },
        }
      );
    } catch (error) {
      console.error('Failed to open checkout:', error);
      showErrorToast(t('subscription.upgradeError') || 'Failed to upgrade. Please try again.');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportOrganizationData();
      showSuccessToast(t('organization.exportSuccess') || 'Data exported successfully');
    } catch (error) {
      console.error('Failed to export data:', error);
      showErrorToast(t('organization.exportError') || 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const calculateUsagePercentage = (current: number, limit: number) => {
    if (isUnlimited(limit)) return 0;
    return Math.min(Math.round((current / limit) * 100), 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('subscription.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('subscription.subtitle')}
          </p>
        </div>

        {/* Grace Period Banner */}
        {gracePeriodEndsAt && currentOrganization && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  {t('subscription.gracePeriod.title')}
                </h3>
                <p className="text-red-800 dark:text-red-200 mb-4">
                  {t('subscription.gracePeriod.message', {
                    days: Math.ceil((gracePeriodEndsAt - Date.now()) / (24 * 60 * 60 * 1000)),
                    date: formatDate(gracePeriodEndsAt)
                  })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {t('organization.exportData')}
                      </>
                    )}
                  </button>
                  <a
                    href={`https://customer-portal.paddle.com/subscriptions/${organizationSubscription?.paddleSubscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('subscription.resubscribe')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Individual Subscription Cancellation Banner */}
        {individualSubscription?.cancelAtPeriodEnd && organizationSubscription && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  {t('subscription.individualCancelling.title')}
                </h3>
                <p className="text-blue-800 dark:text-blue-200">
                  {t('subscription.individualCancelling.message', {
                    date: formatDate(individualSubscription.currentPeriodEnd)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {plan.name}
                </h2>
                {currentOrganization && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded-full">
                    <Building2 className="w-3 h-3" />
                    {t('subscription.organizationPlan')}
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {plan.description}
              </p>
            </div>
            {subscription && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                {getStatusIcon(subscription.status)}
                <span className="capitalize">{subscription.status}</span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <CreditCard className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('subscription.price')}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {plan.price.monthly === 0 ? t('pricing.free') : `$${plan.price.monthly}/mo`}
                </p>
              </div>
            </div>

            {subscription && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('subscription.renewsOn')}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Plan Features */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              {t('subscription.features')}
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.documentsPerDay')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {isAdmin ? '∞' : (isUnlimited(plan.limits.documentsPerDay) ? t('pricing.features.unlimited') : plan.limits.documentsPerDay)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.documentsPerMonth')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {isAdmin ? '∞' : (isUnlimited(plan.limits.documentsPerMonth) ? t('pricing.features.unlimited') : plan.limits.documentsPerMonth)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.maxTemplates')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {isAdmin ? '∞' : (isUnlimited(plan.limits.maxTemplates) ? t('pricing.features.unlimited') : plan.limits.maxTemplates)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.maxFileSize')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {plan.limits.maxFileSize}MB
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.batchProcessing')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {plan.limits.batchProcessing ? t('common.yes') : t('common.no')}
                </span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">{t('subscription.prioritySupport')}:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">
                  {plan.limits.prioritySupport ? t('common.yes') : t('common.no')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {t('subscription.usage')}
          </h2>

          <div className="space-y-4">
            {/* Documents Today */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('subscription.documentsToday')}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {usage.documentsToday} / {isAdmin ? '∞' : (isUnlimited(plan.limits.documentsPerDay) ? '∞' : plan.limits.documentsPerDay)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${isAdmin ? 0 : calculateUsagePercentage(usage.documentsToday, plan.limits.documentsPerDay)}%` }}
                />
              </div>
            </div>

            {/* Documents This Month */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('subscription.documentsThisMonth')}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {usage.documentsThisMonth} / {isAdmin ? '∞' : (isUnlimited(plan.limits.documentsPerMonth) ? '∞' : plan.limits.documentsPerMonth)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${isAdmin ? 0 : calculateUsagePercentage(usage.documentsThisMonth, plan.limits.documentsPerMonth)}%` }}
                />
              </div>
            </div>

            {/* Templates */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('subscription.templateCount')}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {usage.totalTemplates} / {isAdmin ? '∞' : (isUnlimited(plan.limits.maxTemplates) ? '∞' : plan.limits.maxTemplates)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${isAdmin ? 0 : calculateUsagePercentage(usage.totalTemplates, plan.limits.maxTemplates)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Options */}
        {plan.id !== 'enterprise' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              {t('subscription.upgradePlans')}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(SUBSCRIPTION_PLANS)
                .filter(p => p.type === 'individual' && p.price.monthly > plan.price.monthly)
                .map((upgradePlan) => (
                  <div
                    key={upgradePlan.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-primary-500 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {upgradePlan.name}
                    </h3>
                    <p className="text-2xl font-bold text-primary-600 mb-2">
                      ${upgradePlan.price.monthly}
                      <span className="text-sm font-normal text-slate-600 dark:text-slate-400">/mo</span>
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      {upgradePlan.description}
                    </p>
                    <button
                      onClick={() => handleUpgrade(upgradePlan.id)}
                      disabled={upgradeLoading}
                      className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {upgradeLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          {t('subscription.upgradeButton')}
                          <ArrowUpRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Paddle Customer Portal Link */}
        {subscription?.paddleCustomerId && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              {t('subscription.managePayment')}
            </p>
            <a
              href={`https://customer-portal.paddle.com/subscriptions/${subscription.paddleSubscriptionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center gap-1"
            >
              {t('subscription.openPaddlePortal')}
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;
