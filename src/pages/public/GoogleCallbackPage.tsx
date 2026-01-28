import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleRedirectCallback } from '@junobuild/core';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const GoogleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessed = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      // Prevent double execution in StrictMode
      if (hasProcessed.current) {
        return;
      }
      hasProcessed.current = true;

      try {
        await handleRedirectCallback();
        showSuccessToast('Úspešne prihlásený cez Google!');
        // Navigate to app after successful authentication
        navigate('/app', { replace: true });
      } catch (error) {
        console.error('Google callback error:', error);
        showErrorToast('Prihlásenie cez Google zlyhalo. Skúste to prosím znova.');
        navigate('/', { replace: true });
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-slate-900 dark:text-white text-lg">Dokončujem prihlásenie cez Google...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default GoogleCallbackPage;
