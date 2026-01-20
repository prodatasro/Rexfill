import { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CTASection: FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28 bg-linear-to-br from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950 relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {t('landing.cta.title')}
          </h2>
          <p className="text-lg sm:text-xl text-primary-100 mb-10 leading-relaxed">
            {t('landing.cta.subtitle')}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-semibold text-lg px-8 py-4 rounded-lg hover:bg-primary-50 transition-colors shadow-lg hover:shadow-xl"
          >
            {t('landing.cta.button')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
