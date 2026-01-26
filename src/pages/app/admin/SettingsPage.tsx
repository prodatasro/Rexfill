import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import { ShieldCheck } from 'lucide-react';
import type { PlatformAdmin } from '../../../types';
import { useAuth } from '../../../contexts';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin_platform_admins'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'platform_admins',
      });
      return items;
    },
  });

  const { data: adminActions } = useQuery({
    queryKey: ['admin_my_actions'],
    queryFn: async () => {
      if (!user) return [];
      const { items } = await listDocs({
        collection: 'admin_actions',
      });
      return items
        .filter(item => (item.data as any).adminId === user.key)
        .sort((a, b) => (b.data as any).timestamp - (a.data as any).timestamp)
        .slice(0, 50);
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('admin.settings.title', 'Admin Settings')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('admin.settings.subtitle', 'Manage admin users and permissions')}
          </p>
        </div>
        
        {/* Single admin policy notice */}
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {t('admin.settings.singleAdminPolicy.title', 'Single Admin Policy')}
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {t('admin.settings.singleAdminPolicy.description', 'This platform operates with a single administrator. The first user who logged in automatically became the platform admin. This cannot be changed.')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Admins list */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {t('admin.settings.adminUsers', 'Admin Users')}
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {admins?.map(admin => {
            const data = admin.data as PlatformAdmin;
            return (
              <div key={admin.key} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {admin.key}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Added {new Date(data.addedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {user?.key === admin.key && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {t('admin.settings.youLabel', 'You')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin actions history */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('admin.settings.yourActions', 'Your Recent Actions')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.settings.table.timestamp', 'Timestamp')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.settings.table.action', 'Action')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.settings.table.target', 'Target')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {adminActions?.map((action, idx) => {
                const data = action.data as any;
                return (
                  <tr key={`${action.key}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(data.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {data.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.targetType}: {data.targetId.substring(0, 20)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;
