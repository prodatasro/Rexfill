import { FC, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProcessor } from '../../contexts/ProcessorContext';
import { handleRedirectCallback } from '@junobuild/core';
import Header from '../app/Header';
import LoadingSpinner from '../ui/LoadingSpinner';

// Lazy load pages to reduce initial bundle size
const Dashboard = lazy(() => import('../app/Dashboard'));
const ProcessorPage = lazy(() => import('../../pages/app/ProcessorPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage'));

const AppLayout: FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasUnsavedChanges, requestNavigation, currentFolderId } = useProcessor();

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
    const isProcessorPage = location.pathname === '/app/process';

    if (isProcessorPage && hasUnsavedChanges) {
      // Trigger the cancel handler in WordTemplateProcessor
      // The dialog will be shown, and navigation only happens if user confirms
      requestNavigation();
    } else {
      // Navigate directly to dashboard, preserving folder context if on processor page
      if (isProcessorPage && currentFolderId) {
        navigate(`/app?folder=${currentFolderId}`);
      } else {
        navigate('/app');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated users to landing page
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header onLogoClick={handleLogoClick} />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/process" element={<ProcessorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default AppLayout;
