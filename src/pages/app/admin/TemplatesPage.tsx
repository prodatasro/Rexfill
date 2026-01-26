import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { HardDrive } from 'lucide-react';

const TemplatesPage: FC = () => {
  const { t } = useTranslation();

  const { data: templateMeta, isLoading } = useQuery({
    queryKey: ['admin_templates_meta'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'templates_meta',
      });
      return items;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const totalSize = templateMeta?.reduce((acc, t) => acc + ((t.data as any).size || 0), 0) || 0;
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  // Group by user
  const byUser: Record<string, { count: number; size: number }> = {};
  templateMeta?.forEach(t => {
    const userId = t.owner;
    if (!userId) return;
    if (!byUser[userId]) {
      byUser[userId] = { count: 0, size: 0 };
    }
    byUser[userId].count++;
    byUser[userId].size += (t.data as any).size || 0;
  });

  const topUsers = Object.entries(byUser)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.templates.title', 'Templates')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.templates.subtitle', 'Storage analytics and usage')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.templates.stats.total', 'Total Templates')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {templateMeta?.length || 0}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.templates.stats.totalStorage', 'Total Storage')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {totalSizeMB} MB
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('admin.templates.topUsers', 'Top Users by Storage')}
        </h2>
        <div className="space-y-3">
          {topUsers.map(([userId, stats]) => (
            <div key={userId} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm text-slate-900 dark:text-white">
                  {userId.substring(0, 30)}...
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {stats.count} templates
                </div>
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {(stats.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatesPage;
