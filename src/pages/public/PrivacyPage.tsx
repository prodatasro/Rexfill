import { FC } from 'react';
import { useTranslation } from 'react-i18next';

const PrivacyPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="py-20 sm:py-28 bg-white dark:bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {t('privacy.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('privacy.lastUpdated', { date: '2024-01-01' })}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.introduction.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('privacy.sections.introduction.content')}
              </p>
            </section>

            {/* Data Collection */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.dataCollection.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('privacy.sections.dataCollection.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('privacy.sections.dataCollection.item1')}</li>
                <li>{t('privacy.sections.dataCollection.item2')}</li>
                <li>{t('privacy.sections.dataCollection.item3')}</li>
              </ul>
            </section>

            {/* Data Usage */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.dataUsage.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('privacy.sections.dataUsage.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('privacy.sections.dataUsage.item1')}</li>
                <li>{t('privacy.sections.dataUsage.item2')}</li>
                <li>{t('privacy.sections.dataUsage.item3')}</li>
              </ul>
            </section>

            {/* Data Storage */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.dataStorage.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('privacy.sections.dataStorage.content')}
              </p>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.rights.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t('privacy.sections.rights.content')}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                <li>{t('privacy.sections.rights.item1')}</li>
                <li>{t('privacy.sections.rights.item2')}</li>
                <li>{t('privacy.sections.rights.item3')}</li>
                <li>{t('privacy.sections.rights.item4')}</li>
              </ul>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.cookies.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('privacy.sections.cookies.content')}
              </p>
            </section>

            {/* Third Parties */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.thirdParties.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('privacy.sections.thirdParties.content')}
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('privacy.sections.contact.title')}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('privacy.sections.contact.content')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
