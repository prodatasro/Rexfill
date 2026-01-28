import { FC, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import { Users, CreditCard, FileText, Activity, TrendingUp } from 'lucide-react';
import { 
  getCurrentUTCDate, 
  getDateRangeInUTC, 
  getCachedChartData, 
  cacheChartData,
  detectAnomalies,
  fillMissingDates,
  formatDateLocal
} from '../../../utils/dateUtils';
import ChartErrorBoundary from '../../../components/admin/ChartErrorBoundary';
import UsageChart from '../../../components/admin/UsageChart';
import DailyUsageDetailModal from '../../../components/admin/DailyUsageDetailModal';

const DashboardPage: FC = () => {
  const { t, i18n } = useTranslation();

  // State for chart interactions
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(7);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  // Fetch platform admins to exclude from metrics
  const { data: platformAdmins } = useQuery({
    queryKey: ['platform_admins'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'platform_admins',
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Today's usage metric (FIXED - using correct key-based filtering)
  const { data: usage } = useQuery({
    queryKey: ['admin_dashboard_usage_today'],
    queryFn: async () => {
      const today = getCurrentUTCDate();
      const { items } = await listDocs({
        collection: 'usage',
        filter: {
          matcher: {
            key: `_${today}$`
          }
        }
      });
      return items;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Historical usage data for charts
  const { data: historicalUsage, dataUpdatedAt, isLoading: isLoadingCharts } = useQuery({
    queryKey: ['admin_dashboard_usage_historical', timeRange],
    queryFn: async () => {
      const dateRange = getDateRangeInUTC(timeRange);
      const { items } = await listDocs({
        collection: 'usage',
        filter: {
          matcher: {
            createdAt: {
              matcher: 'greaterThan',
              timestamp: dateRange.start
            }
          }
        }
      });
      return items;
    },
    refetchInterval: 60000, // 1 minute
    refetchIntervalInBackground: false,
    initialData: () => getCachedChartData(`historical_${timeRange}`),
    staleTime: 60000, // Consider data fresh for 1 minute
    placeholderData: (previousData) => previousData, // Keep showing old data while fetching new
  });

  // Cache historical data when it updates
  if (historicalUsage) {
    cacheChartData(`historical_${timeRange}`, historicalUsage);
  }

  const activeSubscriptions = subscriptions?.filter(s => (s.data as any).status === 'active').length || 0;
  
  // Create set of admin IDs for filtering
  const adminIds = new Set(platformAdmins?.map(admin => admin.key) || []);
  
  // Fix: Aggregate today's processed documents across all non-admin users
  const todayProcessed = usage?.reduce((sum, doc) => {
    // Extract userId from key (format: userId_YYYY-MM-DD)
    const userId = doc.key.split('_').slice(0, -1).join('_');
    // Exclude admin usage from metrics
    if (adminIds.has(userId)) return sum;
    return sum + ((doc.data as any)?.documentsProcessed || 0);
  }, 0) || 0;

  // Process historical data for charts
  const chartData = historicalUsage ? (() => {
    // Aggregate usage by date (excluding admin usage)
    const dailyData = new Map<string, { documentsProcessed: number; templatesUploaded: number }>();
    
    historicalUsage.forEach((doc: any) => {
      // Extract userId and date from key: {userId}_{YYYY-MM-DD}
      const parts = doc.key.split('_');
      const date = parts[parts.length - 1]; // Last part is the date
      const userId = parts.slice(0, -1).join('_'); // Everything before last underscore is userId
      
      // Skip admin usage
      if (adminIds.has(userId)) return;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      
      const existing = dailyData.get(date) || { documentsProcessed: 0, templatesUploaded: 0 };
      
      existing.documentsProcessed += (doc.data as any)?.documentsProcessed || 0;
      existing.templatesUploaded += (doc.data as any)?.templatesUploaded || 0;
      
      dailyData.set(date, existing);
    });

    // Calculate date range based on timeRange setting
    const endDate = getCurrentUTCDate();
    const startDate = new Date(endDate + 'T00:00:00Z');
    startDate.setDate(startDate.getDate() - timeRange + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fill missing dates for the entire range
    const filled = fillMissingDates(
      startDateStr,
      endDate,
      dailyData
    );

    return filled.map(item => ({
      date: item.date,
      value: item.documentsProcessed,
      count: item.documentsProcessed, // For compatibility with chart component
      templatesValue: item.templatesUploaded,
      label: formatDateLocal(item.date, i18n.language)
    }));
  })() : [];

  // Detect anomalies and merge back into chartData
  const chartDataWithAnomalies = useMemo(() => {
    if (chartData.length === 0) return [];
    const anomalies = detectAnomalies(chartData.map(d => ({ date: d.date, count: d.count })));
    const anomalyMap = new Map(anomalies.map(a => [a.date, a]));
    
    return chartData.map(item => ({
      ...item,
      isAnomaly: anomalyMap.get(item.date)?.isAnomaly,
      anomalyReason: anomalyMap.get(item.date)?.anomalyReason
    }));
  }, [chartData]);

  const anomalyDates = new Set(chartDataWithAnomalies.filter(d => d.isAnomaly).map(d => d.date));

  // Handlers
  const handleTimeRangeChange = useCallback((range: 7 | 14 | 30) => {
    setTimeRange(range);
  }, []);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
    setModalVisible(true);
  }, []);
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

      {/* Usage Trends Section */}
      <div className="space-y-6">
        {/* Comparison Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('admin.dashboard.usageTrends', 'Usage Trends')}
            </h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('admin.dashboard.comparisonMode', 'Comparison Mode')}
            </span>
          </label>
        </div>

        {/* Charts Grid */}
        <div className={`grid gap-6 ${comparisonMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {isLoadingCharts && !historicalUsage ? (
            <div className="col-span-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {t('admin.dashboard.chart.loading', 'Loading chart data...')}
              </p>
            </div>
          ) : chartDataWithAnomalies.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center">
              <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {t('admin.dashboard.chart.noData', 'No data available')}
              </p>
            </div>
          ) : (
            <>
              {/* Documents Processed Chart */}
              <ChartErrorBoundary>
                <UsageChart
                  data={chartDataWithAnomalies}
                  timeRange={timeRange}
                  onTimeRangeChange={handleTimeRangeChange}
                  onExport={(format) => {
                    // Export is handled internally by the chart component
                    console.log(`Exporting ${format} for documents processed`);
                  }}
                  onDateClick={handleDateClick}
                  showUpdateIndicator={Date.now() - dataUpdatedAt < 10000}
                  color="rgb(59, 130, 246)" // blue-500
                  metricKey="documentsProcessed"
                  title={t('admin.dashboard.processingTrends', 'Documents Processed Over Time')}
                  comparisonMode={comparisonMode}
                  comparisonData={comparisonMode ? chartDataWithAnomalies.map(d => ({
                    ...d,
                    count: d.templatesValue || 0
                  })) : undefined}
                  comparisonColor={comparisonMode ? "rgb(168, 85, 247)" : undefined} // purple-500
                  comparisonMetricKey={comparisonMode ? "templatesUploaded" : undefined}
                />
              </ChartErrorBoundary>

              {/* Templates Uploaded Chart (only show when NOT in comparison mode) */}
              {!comparisonMode && (
                <ChartErrorBoundary>
                  <UsageChart
                    data={chartDataWithAnomalies.map(d => ({
                      ...d,
                      count: d.templatesValue || 0
                    }))}
                    timeRange={timeRange}
                    onTimeRangeChange={handleTimeRangeChange}
                    onExport={(format) => {
                      console.log(`Exporting ${format} for templates uploaded`);
                    }}
                    onDateClick={handleDateClick}
                    showUpdateIndicator={Date.now() - dataUpdatedAt < 10000}
                    color="rgb(168, 85, 247)" // purple-500
                    metricKey="templatesUploaded"
                    title={t('admin.dashboard.uploadTrends', 'Templates Uploaded Over Time')}
                  />
                </ChartErrorBoundary>
              )}
            </>
          )}
        </div>
      </div>

      {/* Daily Usage Detail Modal */}
      {selectedDate && (
        <DailyUsageDetailModal
          isOpen={modalVisible}
          selectedDate={selectedDate}
          isAnomaly={anomalyDates.has(selectedDate)}
          onClose={() => {
            setModalVisible(false);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;