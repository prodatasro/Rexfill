import { FC } from 'react';
import { FileText, Lightbulb, AlertCircle, CheckCircle, Code2, Zap, BookOpen } from 'lucide-react';
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
          {/* Section 1: Custom Properties */}
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
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('guides.sections.customProperties.howTo')}
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                  <li>{t('guides.sections.customProperties.step1')}</li>
                  <li>{t('guides.sections.customProperties.step2')}</li>
                  <li>{t('guides.sections.customProperties.step3')}</li>
                  <li>{t('guides.sections.customProperties.step4')}</li>
                  <li>{t('guides.sections.customProperties.step5')}</li>
                </ol>
              </div>

              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <p className="text-sm text-primary-900 dark:text-primary-100">
                  <strong className="font-semibold">💡 Pro Tip:</strong> {t('guides.sections.customProperties.benefit')}
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: DOCPROPERTY Fields */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Code2 className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.docproperty.title')}
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
              <p className="text-slate-600 dark:text-slate-400">
                {t('guides.sections.docproperty.intro')}
              </p>

              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('guides.sections.docproperty.howToInsert')}
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                  <li>{t('guides.sections.docproperty.insertStep1')}</li>
                  <li>{t('guides.sections.docproperty.insertStep2')}</li>
                  <li>{t('guides.sections.docproperty.insertStep3')}</li>
                  <li>{t('guides.sections.docproperty.insertStep4')}</li>
                </ol>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('guides.sections.docproperty.alternativeMethod')}
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                  <li>{t('guides.sections.docproperty.altStep1')}</li>
                  <li>{t('guides.sections.docproperty.altStep2')}</li>
                  <li>{t('guides.sections.docproperty.altStep3')}</li>
                  <li>{t('guides.sections.docproperty.altStep4')}</li>
                </ol>
              </div>

              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <p className="text-sm text-primary-900 dark:text-primary-100">
                  <strong className="font-semibold">🔄 Updating Fields:</strong> {t('guides.sections.docproperty.updating')}
                </p>
              </div>
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
              <ul className="space-y-3">
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
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip6')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('guides.sections.bestPractices.tip7')}
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Advanced Techniques */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.advanced.title')}
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
              {/* Formulas */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  {t('guides.sections.advanced.formulas')}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.formulaTip1')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.formulaTip2')}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Conditional Text */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  {t('guides.sections.advanced.conditionalText')}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.conditionalTip1')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.conditionalTip2')}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Automation */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  {t('guides.sections.advanced.automation')}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.autoTip1')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.autoTip2')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-1">•</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t('guides.sections.advanced.autoTip3')}
                    </span>
                  </li>
                </ul>
              </div>
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
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue4.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue4.solution')}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue5.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue5.solution')}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.troubleshooting.issue6.title')}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('guides.sections.troubleshooting.issue6.solution')}
                </p>
              </div>
            </div>
          </section>

          {/* Practical Examples */}
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('guides.sections.examples.title')}
              </h2>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t('guides.sections.examples.subtitle')}
            </p>

            <div className="space-y-6">
              {/* Example 1 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.examples.example1.title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                  {t('guides.sections.examples.example1.description')}
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 mb-2">
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {t('guides.sections.examples.example1.properties')}
                  </p>
                </div>
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded p-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <strong>Usage:</strong> {t('guides.sections.examples.example1.usage')}
                  </p>
                </div>
              </div>

              {/* Example 2 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.examples.example2.title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                  {t('guides.sections.examples.example2.description')}
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 mb-2">
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {t('guides.sections.examples.example2.properties')}
                  </p>
                </div>
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded p-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <strong>Usage:</strong> {t('guides.sections.examples.example2.usage')}
                  </p>
                </div>
              </div>

              {/* Example 3 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {t('guides.sections.examples.example3.title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                  {t('guides.sections.examples.example3.description')}
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 mb-2">
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {t('guides.sections.examples.example3.properties')}
                  </p>
                </div>
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded p-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <strong>Usage:</strong> {t('guides.sections.examples.example3.usage')}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GuidesPage;
