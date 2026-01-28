import { FC, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useUserProfile } from '../../contexts/UserProfileContext';
import {
  ProfileNavigation,
  ProfileMobileNav,
  ProfileInfo,
  AccountSettings,
  SubscriptionSection,
  ActivityLogSection,
  DataManagementSection,
} from '../../components/profile';
import type { ProfileSection } from '../../components/profile/ProfileNavigation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/dialogs';

const ProfilePage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Handle success parameter from Paddle redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      setActiveSection('subscription');
      setShowSuccessDialog(true);
      // Clean up URL
      window.history.replaceState({}, '', '/app/profile');
    }
  }, [location.search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-600 dark:text-slate-400">{t('profile.notLoggedIn')}</p>
      </div>
    );
  }

  // If profile is still loading, show spinner
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileInfo />;
      case 'settings':
        return <AccountSettings />;
      case 'subscription':
        return <SubscriptionSection />;
      case 'data':
        return <DataManagementSection />;
      case 'activity':
        return <ActivityLogSection />;
      default:
        return <ProfileInfo />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 sm:px-6 lg:px-8 pt-0 sm:pt-1 lg:pt-1 pb-4 sm:pb-6 lg:pb-8">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 mb-4 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
            {t('common.back', 'Back to Dashboard')}
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            {t('profile.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Mobile Navigation */}
        <ProfileMobileNav activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Sidebar Navigation (Desktop) */}
          <div className="lg:col-span-2">
            <ProfileNavigation activeSection={activeSection} onSectionChange={setActiveSection} />
          </div>

          {/* Content Area */}
          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <ConfirmDialog
        isOpen={showSuccessDialog}
        title={t('subscription.success.title', 'Subscription Activated!')}
        message={t('subscription.success.message', 'Your subscription has been successfully activated. You can now enjoy all the benefits of your new plan.')}
        confirmLabel={t('common.ok', 'OK')}
        onConfirm={() => setShowSuccessDialog(false)}
        onCancel={() => setShowSuccessDialog(false)}
        variant="info"
      />
    </div>
  );
};

export default ProfilePage;
