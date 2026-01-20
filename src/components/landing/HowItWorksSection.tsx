import { FC } from 'react';
import { Upload, Edit3, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const HowItWorksSection: FC = () => {
  const { t } = useTranslation();

  const steps = [
    {
      icon: <Upload className="w-8 h-8" />,
      number: '01',
      titleKey: 'landing.howItWorks.step1.title',
      descriptionKey: 'landing.howItWorks.step1.description',
    },
    {
      icon: <Edit3 className="w-8 h-8" />,
      number: '02',
      titleKey: 'landing.howItWorks.step2.title',
      descriptionKey: 'landing.howItWorks.step2.description',
    },
    {
      icon: <Download className="w-8 h-8" />,
      number: '03',
      titleKey: 'landing.howItWorks.step3.title',
      descriptionKey: 'landing.howItWorks.step3.description',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white dark:bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('landing.howItWorks.title')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t('landing.howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
            {/* Connection line - desktop only */}
            <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200 dark:from-primary-800 dark:via-primary-600 dark:to-primary-800" />

            {steps.map((step, index) => (
              <div key={index} className="relative text-center">
                {/* Step number badge */}
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="w-32 h-32 bg-primary-50 dark:bg-primary-900/20 rounded-3xl flex items-center justify-center">
                    <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400">
                      {step.icon}
                    </div>
                  </div>
                  {/* Number badge */}
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                  {t(step.titleKey)}
                </h3>

                {/* Description */}
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(step.descriptionKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
