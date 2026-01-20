import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUBSCRIPTION_PLANS, isUnlimited } from '../../config/plans';

const PricingPage: FC = () => {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    { ...SUBSCRIPTION_PLANS.free, popular: false },
    { ...SUBSCRIPTION_PLANS.starter, popular: false },
    { ...SUBSCRIPTION_PLANS.professional, popular: true },
    { ...SUBSCRIPTION_PLANS.enterprise, popular: false },
  ];

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.price.monthly === 0) return t('pricing.free');
    return billingCycle === 'monthly'
      ? `$${plan.price.monthly}`
      : `$${Math.round(plan.price.annual / 12)}`;
  };

  const formatLimit = (value: number, type: 'docs' | 'templates' | 'size') => {
    if (isUnlimited(value)) return t('pricing.features.unlimited');
    if (type === 'size') return `${value}MB`;
    return value.toString();
  };

  return (
    <div className="py-20 sm:py-28 bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            {t('pricing.subtitle')}
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('pricing.annual')}
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                {t('pricing.annualDiscount')}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-slate-800 rounded-2xl p-6 lg:p-8 border ${
                plan.popular
                  ? 'border-primary-500 dark:border-primary-400 shadow-xl shadow-primary-100 dark:shadow-primary-900/20 scale-[1.02]'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                    {t('pricing.popular')}
                  </span>
                </div>
              )}

              {/* Plan name */}
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {t(`pricing.plans.${plan.id}.name`)}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                {t(`pricing.plans.${plan.id}.description`)}
              </p>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  {getPrice(plan)}
                </span>
                {plan.price.monthly > 0 && (
                  <span className="text-slate-600 dark:text-slate-400 ml-1">
                    {t('pricing.perMonth')}
                  </span>
                )}
              </div>

              {/* CTA button */}
              <Link
                to="/app"
                className={`block text-center py-3 px-4 rounded-lg font-semibold transition-all mb-8 ${
                  plan.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {t(`pricing.plans.${plan.id}.cta`)}
              </Link>

              {/* Features list */}
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {t('pricing.features.documentsPerDay', { value: formatLimit(plan.limits.documentsPerDay, 'docs') })}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {t('pricing.features.documentsPerMonth', { value: formatLimit(plan.limits.documentsPerMonth, 'docs') })}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {t('pricing.features.maxTemplates', { value: formatLimit(plan.limits.maxTemplates, 'templates') })}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {t('pricing.features.maxFileSize', { size: plan.limits.maxFileSize })}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  {plan.limits.batchProcessing ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  )}
                  <span className={plan.limits.batchProcessing ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                    {t('pricing.features.batchProcessing')}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  {plan.limits.prioritySupport ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  )}
                  <span className={plan.limits.prioritySupport ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                    {t('pricing.features.prioritySupport')}
                  </span>
                </li>
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            {t('pricing.questions')}{' '}
            <Link to="/contact" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
              {t('pricing.contactUs')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
