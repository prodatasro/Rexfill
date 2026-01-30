import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Webhook } from 'lucide-react';
import { webhookHistoryRepository } from '../../../dal';

const WebhooksPage: FC = () => {
  const { t } = useTranslation();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['admin_webhooks'],
    queryFn: async () => {
      return await webhookHistoryRepository.listAllSorted();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const successCount = webhooks?.filter(w => (w.data as any).processed).length || 0;
  const failureCount = (webhooks?.length || 0) - successCount;
  const successRate = webhooks?.length ? ((successCount / webhooks.length) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.webhooks.title', 'Webhooks')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.webhooks.subtitle', 'Monitor Paddle webhook events')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.webhooks.stats.total', 'Total Events')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {webhooks?.length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.webhooks.stats.failures', 'Failures')}
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {failureCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.webhooks.stats.successRate', 'Success Rate')}
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {successRate}%
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.webhooks.table.timestamp', 'Timestamp')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.webhooks.table.eventType', 'Event Type')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.webhooks.table.status', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.webhooks.table.error', 'Error')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {webhooks?.slice(0, 50).map((webhook, idx) => {
                const data = webhook.data as any;
                return (
                  <tr key={`${webhook.key}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(data.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      <Webhook className="w-4 h-4 inline mr-2" />
                      {data.eventType}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          data.processed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {data.processed ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.error || '-'}
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

export default WebhooksPage;
