import { FC, useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handleRedirectCallback } from '@junobuild/core';
import Header from './Header';
import LoginScreen from './auth/LoginScreen';
import LoadingSpinner from './ui/LoadingSpinner';

// Lazy load Dashboard to reduce initial bundle size
const Dashboard = lazy(() => import('./Dashboard'));

const Layout: FC = () => {
  const { user, loading } = useAuth();
  const [dashboardKey, setDashboardKey] = useState(0);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if we're coming back from Internet Identity
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('ii-callback')) {
        try {
          await handleRedirectCallback();
          // Clean up the URL after successful authentication
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Authentication callback failed:', error);
        }
      }
    };

    handleAuthCallback();
  }, []);

  const handleLogoClick = () => {
    // Force remount of Dashboard by changing its key
    setDashboardKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header onLogoClick={handleLogoClick} />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <Dashboard key={dashboardKey} />
        </Suspense>
      </main>
    </div>
  );
};

export default Layout;
