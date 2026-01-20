import { FC } from 'react';
import { FileText, FolderTree, Layers, Settings, Moon, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FeatureCard from './FeatureCard';

const FeaturesSection: FC = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: <FileText className="w-6 h-6" />,
      titleKey: 'landing.features.templateProcessing.title',
      descriptionKey: 'landing.features.templateProcessing.description',
    },
    {
      icon: <FolderTree className="w-6 h-6" />,
      titleKey: 'landing.features.folderOrganization.title',
      descriptionKey: 'landing.features.folderOrganization.description',
    },
    {
      icon: <Layers className="w-6 h-6" />,
      titleKey: 'landing.features.batchProcessing.title',
      descriptionKey: 'landing.features.batchProcessing.description',
    },
    {
      icon: <Settings className="w-6 h-6" />,
      titleKey: 'landing.features.customProperties.title',
      descriptionKey: 'landing.features.customProperties.description',
    },
    {
      icon: <Moon className="w-6 h-6" />,
      titleKey: 'landing.features.darkMode.title',
      descriptionKey: 'landing.features.darkMode.description',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      titleKey: 'landing.features.multiLanguage.title',
      descriptionKey: 'landing.features.multiLanguage.description',
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t('landing.features.subtitle')}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={t(feature.titleKey)}
              description={t(feature.descriptionKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
