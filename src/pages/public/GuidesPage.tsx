import { FC } from 'react';
import { FileText, Code, Lightbulb, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GuidesPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="py-20 sm:py-28 bg-white dark:bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {t('guides.title')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t('guides.subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Section 1: Placeholders */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Code className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.placeholders.title')}
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {t('guides.sections.placeholders.intro')}
              </p>

              {/* Example */}
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-4 font-mono text-sm">
                <p className="text-slate-800 dark:text-slate-200">
                  {t('guides.sections.placeholders.example1')}
                </p>
              </div>

              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {t('guides.sections.placeholders.description')}
              </p>

              {/* Do's and Don'ts */}
              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-800 dark:text-green-200">{t('guides.sections.placeholders.correct')}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                    <li><code className="bg-green-100 dark:bg-green-800 px-1 rounded">{'{{name}}'}</code></li>
                    <li><code className="bg-green-100 dark:bg-green-800 px-1 rounded">{'{{company_name}}'}</code></li>
                    <li><code className="bg-green-100 dark:bg-green-800 px-1 rounded">{'{{date_of_birth}}'}</code></li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="font-semibold text-red-800 dark:text-red-200">{t('guides.sections.placeholders.incorrect')}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-red-700 dark:text-red-300">
                    <li><code className="bg-red-100 dark:bg-red-800 px-1 rounded">{'{name}'}</code> - {t('guides.sections.placeholders.singleBrace')}</li>
                    <li><code className="bg-red-100 dark:bg-red-800 px-1 rounded">{'{{ name }}'}</code> - {t('guides.sections.placeholders.spaces')}</li>
                    <li><code className="bg-red-100 dark:bg-red-800 px-1 rounded">{'{{Name}}'}</code> - {t('guides.sections.placeholders.caseSensitive')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Custom Properties */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.customProperties.title')}
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {t('guides.sections.customProperties.intro')}
              </p>

              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('guides.sections.customProperties.howTo')}</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  <li>{t('guides.sections.customProperties.step1')}</li>
                  <li>{t('guides.sections.customProperties.step2')}</li>
                  <li>{t('guides.sections.customProperties.step3')}</li>
                  <li>{t('guides.sections.customProperties.step4')}</li>
                </ol>
              </div>

              <p className="text-slate-600 dark:text-slate-400">
                {t('guides.sections.customProperties.benefit')}
              </p>
            </div>
          </section>

          {/* Section 3: Best Practices */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Lightbulb className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.bestPractices.title')}
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip1')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip2')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip3')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip4')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip5')}
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.troubleshooting.title')}
              </h2>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue1.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue1.solution')}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue2.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue2.solution')}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue3.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue3.solution')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GuidesPage;
