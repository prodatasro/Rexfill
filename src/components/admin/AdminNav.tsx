import { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Mail,
  Activity,
  FileText,
  Webhook,
  Settings,
  ArrowLeft,
} from 'lucide-react';

export const AdminNav: FC = () => {
  const { t } = useTranslation();

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t('admin.nav.dashboard', 'Dashboard') },
    { path: '/admin/users', icon: Users, label: t('admin.nav.users', 'Users') },
    { path: '/admin/organizations', icon: Building2, label: t('admin.nav.organizations', 'Organizations') },
    { path: '/admin/subscriptions', icon: CreditCard, label: t('admin.nav.subscriptions', 'Subscriptions') },
    { path: '/admin/contact-inbox', icon: Mail, label: t('admin.nav.contactInbox', 'Contact Inbox') },
    { path: '/admin/activity-logs', icon: Activity, label: t('admin.nav.activityLogs', 'Activity Logs') },
    { path: '/admin/templates', icon: FileText, label: t('admin.nav.templates', 'Templates') },
    { path: '/admin/webhooks', icon: Webhook, label: t('admin.nav.webhooks', 'Webhooks') },
    { path: '/admin/settings', icon: Settings, label: t('admin.nav.settings', 'Settings') },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          {t('admin.title', 'Admin Panel')}
        </h1>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
          <NavLink
            to="/app"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('admin.nav.backToApp', 'Back to App')}</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
