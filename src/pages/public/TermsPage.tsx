import { FC } from 'react';
import { useTranslation } from 'react-i18next';

const TermsPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="py-20 sm:py-28 bg-white dark:bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {t('terms.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('terms.lastUpdated', { date: '2024-01-01' })}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {/* Acceptance */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.acceptance.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.acceptance.content')}
              </p>
            </section>

            {/* Service Description */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.service.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.service.content')}
              </p>
            </section>

            {/* User Accounts */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.accounts.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('terms.sections.accounts.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('terms.sections.accounts.item1')}</li>
                <li>{t('terms.sections.accounts.item2')}</li>
                <li>{t('terms.sections.accounts.item3')}</li>
              </ul>
            </section>

            {/* Subscription and Payments */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.payments.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('terms.sections.payments.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('terms.sections.payments.item1')}</li>
                <li>{t('terms.sections.payments.item2')}</li>
                <li>{t('terms.sections.payments.item3')}</li>
              </ul>
            </section>

            {/* Acceptable Use */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.acceptableUse.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('terms.sections.acceptableUse.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('terms.sections.acceptableUse.item1')}</li>
                <li>{t('terms.sections.acceptableUse.item2')}</li>
                <li>{t('terms.sections.acceptableUse.item3')}</li>
                <li>{t('terms.sections.acceptableUse.item4')}</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.intellectualProperty.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.intellectualProperty.content')}
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.liability.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.liability.content')}
              </p>
            </section>

            {/* Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.termination.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.termination.content')}
              </p>
            </section>

            {/* Changes */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.changes.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.changes.content')}
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('terms.sections.contact.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('terms.sections.contact.content')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
