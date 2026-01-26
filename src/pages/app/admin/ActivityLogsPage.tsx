import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Activity } from 'lucide-react';

const ActivityLogsPage: FC = () => {
  const { t } = useTranslation();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin_activity_logs'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'activity_logs',
      });
      return items.sort((a, b) => (b.data as any).timestamp - (a.data as any).timestamp);
    },
    refetchInterval: 5000, // Refetch every 5 seconds
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.activityLogs.title', 'Activity Logs')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.activityLogs.subtitle', 'Monitor all system activity')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.activityLogs.table.timestamp', 'Timestamp')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.activityLogs.table.action', 'Action')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.activityLogs.table.resource', 'Resource')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.activityLogs.table.user', 'User')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {logs?.slice(0, 100).map((log, idx) => {
                const data = log.data as any;
                return (
                  <tr key={`${log.key}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(data.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      <Activity className="w-4 h-4 inline mr-2" />
                      {data.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.resource_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.created_by?.substring(0, 20)}...
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

export default ActivityLogsPage;
