import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import { Users, CreditCard, FileText, Activity } from 'lucide-react';

const DashboardPage: FC = () => {
  const { t } = useTranslation();

  const { data: users } = useQuery({
    queryKey: ['admin_dashboard_users'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'user_profiles',
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false, // Only refetch when tab is visible
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['admin_dashboard_subscriptions'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'subscriptions',
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: templateMeta } = useQuery({
    queryKey: ['admin_dashboard_templates'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'templates_meta',
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: usage } = useQuery({
    queryKey: ['admin_dashboard_usage'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'usage_tracking',
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const activeSubscriptions = subscriptions?.filter(s => (s.data as any).status === 'active').length || 0;
  
  const today = new Date().toISOString().split('T')[0];
  const todayUsage = usage?.find(u => (u.data as any).date === today);
  const todayProcessed = (todayUsage?.data as any)?.documentsProcessed || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.dashboard.title', 'Admin Dashboard')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.dashboard.subtitle', 'Platform overview and statistics')}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.dashboard.metrics.totalUsers', 'Total Users')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {users?.length || 0}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.dashboard.metrics.activeSubscriptions', 'Active Subscriptions')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {activeSubscriptions}
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.dashboard.metrics.totalTemplates', 'Total Templates')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {templateMeta?.length || 0}
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.dashboard.metrics.todayProcessed', 'Today Processed')}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {todayProcessed}
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('admin.dashboard.planDistribution', 'Plan Distribution')}
        </h2>
        <div className="space-y-3">
          {['free', 'starter', 'professional', 'enterprise', 'team', 'business'].map(plan => {
            const count = subscriptions?.filter(s => (s.data as any).planId === plan).length || 0;
            const percentage = subscriptions?.length ? (count / subscriptions.length) * 100 : 0;
            
            return (
              <div key={plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{plan}</span>
                  <span className="text-slate-600 dark:text-slate-400">{count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
