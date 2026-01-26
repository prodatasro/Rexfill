import { FC, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { AdminGuard } from './AdminGuard';
import { AdminNav } from './AdminNav';
import LoadingSpinner from '../ui/LoadingSpinner';

// Lazy load admin pages
const DashboardPage = lazy(() => import('../../pages/app/admin/DashboardPage'));
const UsersPage = lazy(() => import('../../pages/app/admin/UsersPage'));
const OrganizationsPage = lazy(() => import('../../pages/app/admin/OrganizationsPage'));
const SubscriptionsPage = lazy(() => import('../../pages/app/admin/SubscriptionsPage'));
const ContactInboxPage = lazy(() => import('../../pages/app/admin/ContactInboxPage'));
const ActivityLogsPage = lazy(() => import('../../pages/app/admin/ActivityLogsPage'));
const TemplatesPage = lazy(() => import('../../pages/app/admin/TemplatesPage'));
const WebhooksPage = lazy(() => import('../../pages/app/admin/WebhooksPage'));
const SettingsPage = lazy(() => import('../../pages/app/admin/SettingsPage'));

const AdminLayout: FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex">
          {/* Sidebar navigation */}
          <AdminNav />

          {/* Main content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-64">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/organizations" element={<OrganizationsPage />} />
                <Route path="/subscriptions" element={<SubscriptionsPage />} />
                <Route path="/contact-inbox" element={<ContactInboxPage />} />
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/webhooks" element={<WebhooksPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default AdminLayout;
