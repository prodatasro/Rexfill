import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { subscriptionRepository } from '../../../dal';
import { Button } from '../../../components/ui';
import { CreditCard } from 'lucide-react';

const SubscriptionsPage: FC = () => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin_all_subscriptions'],
    queryFn: async () => {
      return await subscriptionRepository.list();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const activeCount = subscriptions?.filter(s => (s.data as any).status === 'active').length || 0;
  const totalMRR = subscriptions?.reduce((acc, s) => {
    const data = s.data as any;
    if (data.status === 'active' && data.paddleData?.price) {
      return acc + parseFloat(data.paddleData.price);
    }
    return acc;
  }, 0) || 0;

  // Pagination
  const totalPages = Math.ceil((subscriptions?.length || 0) / pageSize);
  const paginatedSubscriptions = subscriptions?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.subscriptions.title', 'Subscriptions')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.subscriptions.subtitle', 'Manage user subscriptions')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.subscriptions.stats.total', 'Total Subscriptions')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {subscriptions?.length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.subscriptions.stats.active', 'Active')}
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {activeCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.subscriptions.stats.mrr', 'MRR')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${totalMRR.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.subscriptions.table.user', 'User')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.subscriptions.table.plan', 'Plan')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.subscriptions.table.status', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.subscriptions.table.type', 'Type')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedSubscriptions?.map(sub => {
                const data = sub.data as any;
                return (
                  <tr key={sub.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {sub.owner?.substring(0, 20) || 'Unknown'}...
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <CreditCard className="w-3 h-3 mr-1" />
                        {data.planId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          data.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {data.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.type}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('admin.pagination.showing', 'Showing')} {((currentPage - 1) * pageSize) + 1} -{' '}
              {Math.min(currentPage * pageSize, subscriptions?.length || 0)} {t('admin.pagination.of', 'of')}{' '}
              {subscriptions?.length || 0}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t('admin.pagination.previous', 'Previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {t('admin.pagination.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsPage;
