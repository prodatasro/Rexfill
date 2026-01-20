import { FC } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Home } from 'lucide-react';

const NotFoundPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine if we're in the app context
  const isAppContext = location.pathname.startsWith('/app');
  const homeRoute = isAppContext ? '/app' : '/';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <FileQuestion className="w-24 h-24 text-slate-300 dark:text-slate-600 mb-6" />
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
        404
      </h1>
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
        {t('notFound.title')}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        {t('notFound.message')}
      </p>
      <button
        onClick={() => navigate(homeRoute)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <Home className="w-5 h-5" />
        {t('notFound.goHome')}
      </button>
    </div>
  );
};

export default NotFoundPage;
