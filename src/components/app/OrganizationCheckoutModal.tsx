import { FC, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OrganizationCheckoutModalProps {
  planId: 'team' | 'business' | 'enterprise_org';
  planName: string;
  price: number;
  onConfirm: (organizationName: string) => void;
  onCancel: () => void;
}

const OrganizationCheckoutModal: FC<OrganizationCheckoutModalProps> = ({
  planId,
  planName,
  price,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationName.trim()) {
      setError(t('organization.nameRequired'));
      return;
    }

    if (organizationName.trim().length < 2) {
      setError(t('organization.nameTooShort'));
      return;
    }

    if (organizationName.trim().length > 100) {
      setError(t('organization.nameTooLong'));
      return;
    }

    onConfirm(organizationName.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('organization.createOrganization')}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="mb-6">
            <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg mb-4">
              <Building2 className="w-6 h-6 text-primary-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {planName} - ${price}/mo
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t('organization.subscriptionInfo')}
                </p>
              </div>
            </div>

            <label htmlFor="orgName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('organization.name')}
            </label>
            <input
              type="text"
              id="orgName"
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value);
                setError('');
              }}
              placeholder={t('organization.namePlaceholder')}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {t('organization.nameHelp')}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
              {t('organization.whatHappensNext')}
            </h3>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5">•</span>
                <span>{t('organization.step1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5">•</span>
                <span>{t('organization.step2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5">•</span>
                <span>{t('organization.step3')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5">•</span>
                <span>{t('organization.step4')}</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('organization.continueToCheckout')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrganizationCheckoutModal;
