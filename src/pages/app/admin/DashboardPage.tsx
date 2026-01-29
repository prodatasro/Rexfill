import { FC, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDocs, setDoc, deleteDoc } from '@junobuild/core';
import { toast } from 'sonner';
import { Users, CreditCard, FileText, Activity, TrendingUp, Key, Plus, Trash2, Eye, EyeOff, Settings } from 'lucide-react';
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
import { Dialog, Button } from '../../../components/ui';
import { useAuth } from '../../../contexts';

const DashboardPage: FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State for chart interactions
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(7);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // State for secrets management
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [secretFormData, setSecretFormData] = useState({ key: '', value: '', description: '', version: undefined as bigint | undefined });
  const [editingSecret, setEditingSecret] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

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

  // Check if current user is platform admin
  const isPlatformAdmin = platformAdmins?.some(admin => admin.key === user?.key) || false;

  // Fetch secrets (only for platform admins)
  const { data: secrets } = useQuery({
    queryKey: ['admin_secrets'],
    queryFn: async () => {
      if (!isPlatformAdmin) return [];
      const { items } = await listDocs({
        collection: 'secrets',
      });
      return items;
    },
    enabled: isPlatformAdmin,
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

  // Secrets mutations
  const saveSecretMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description: string; version?: bigint }) => {
      if (!user) return;

      await setDoc({
        collection: 'secrets',
        doc: {
          key: data.key,
          data: {
            value: data.value,
            description: data.description,
            createdAt: Date.now(),
            createdBy: user.key,
          },
          ...(data.version !== undefined && { version: data.version }),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_secrets'] });
      setShowSecretDialog(false);
      setSecretFormData({ key: '', value: '', description: '', version: undefined });
      setEditingSecret(null);
      toast.success(editingSecret ? 'Secret updated successfully' : 'Secret created successfully');
    },
    onError: () => {
      toast.error('Failed to save secret');
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: async (key: string) => {
      const secretDoc = secrets?.find(s => s.key === key);
      if (!secretDoc) throw new Error('Secret not found');

      await deleteDoc({
        collection: 'secrets',
        doc: secretDoc,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_secrets'] });
      toast.success('Secret deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete secret');
    },
  });

  const configureCanisterMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Get required secrets
      const prodApiKey = secrets?.find(s => s.key === 'PADDLE_API_KEY_PROD')?.data as any;
      const devApiKey = secrets?.find(s => s.key === 'PADDLE_API_KEY_DEV')?.data as any;
      const prodWebhookSecret = secrets?.find(s => s.key === 'PADDLE_WEBHOOK_SECRET_PROD')?.data as any;
      const devWebhookSecret = secrets?.find(s => s.key === 'PADDLE_WEBHOOK_SECRET_DEV')?.data as any;

      // Validate at least one API key exists
      if (!devApiKey?.value && !prodApiKey?.value) {
        throw new Error('At least one Paddle API key (DEV or PROD) is required');
      }

      // Create trigger document to invoke satellite function
      // The satellite function will read secrets and configure the canister
      const triggerId = `config_${Date.now()}`;
      
      await setDoc({
        collection: 'canister_config_triggers',
        doc: {
          key: triggerId,
          data: {
            action: 'configure',
            timestamp: Date.now(),
            triggeredBy: user.key,
            // Metadata for logging purposes
            hasProdKey: !!prodApiKey?.value,
            hasDevKey: !!devApiKey?.value,
            hasProdWebhook: !!prodWebhookSecret?.value,
            hasDevWebhook: !!devWebhookSecret?.value,
          },
        },
      });

      return triggerId;
    },
    onSuccess: () => {
      toast.success('Configuration request sent to RexfillProxy canister');
    },
    onError: (error: any) => {
      console.error('Failed to trigger canister configuration:', error);
      toast.error(`Failed to configure canister: ${error.message || 'Unknown error'}`);
    },
  });

  const handleAddSecret = () => {
    setEditingSecret(null);
    setSecretFormData({ key: '', value: '', description: '', version: undefined });
    setShowSecretDialog(true);
  };

  const handleEditSecret = (secret: any) => {
    setEditingSecret(secret.key);
    setSecretFormData({
      key: secret.key,
      value: secret.data.value || '',
      description: secret.data.description || '',
      version: secret.version,
    });
    setShowSecretDialog(true);
  };

  const handleSaveSecret = () => {
    if (!secretFormData.key || !secretFormData.value) {
      toast.error('Key and value are required');
      return;
    }
    saveSecretMutation.mutate(secretFormData);
  };

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
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

      {/* API Credentials Section - Only for Platform Admins */}
      {isPlatformAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('admin.dashboard.apiCredentials', 'API Credentials')}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => configureCanisterMutation.mutate()}
                disabled={configureCanisterMutation.isPending || !secrets || secrets.length === 0}
              >
                <Settings className="w-4 h-4 mr-2" />
                {configureCanisterMutation.isPending ? 'Configuring...' : 'Configure Canister'}
              </Button>
              <Button onClick={handleAddSecret}>
                <Plus className="w-4 h-4 mr-2" />
                {t('admin.dashboard.addSecret', 'Add Secret')}
              </Button>
            </div>
          </div>

          {secrets && secrets.length > 0 ? (
            <div className="space-y-3">
              {secrets.map(secret => {
                const data = secret.data as any;
                const isVisible = visibleSecrets.has(secret.key);
                
                return (
                  <div key={secret.key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {secret.key}
                        </span>
                        {secret.key.includes('_DEV') && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                            Development
                          </span>
                        )}
                        {secret.key.includes('_PROD') && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Production
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {data.description || 'No description'}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded font-mono">
                          {isVisible ? data.value : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => toggleSecretVisibility(secret.key)}
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSecret(secret)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this secret?')) {
                            deleteSecretMutation.mutate(secret.key);
                          }
                        }}
                        disabled={deleteSecretMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('admin.dashboard.noSecrets', 'No API credentials configured yet.')}
              </p>
              <p className="text-xs mt-1">
                {t('admin.dashboard.addSecretHint', 'Add your Paddle API keys to enable subscription polling.')}
              </p>
            </div>
          )}
        </div>
      )}

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

      {/* Add/Edit Secret Dialog */}
      {showSecretDialog && (
        <Dialog
          isOpen={true}
          onClose={() => {
            setShowSecretDialog(false);
            setSecretFormData({ key: '', value: '', description: '', version: undefined });
            setEditingSecret(null);
          }}
          title={editingSecret ? 'Edit Secret' : 'Add Secret'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Key *
              </label>
              {editingSecret ? (
                <input
                  type="text"
                  value={secretFormData.key}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white opacity-50 cursor-not-allowed"
                />
              ) : (
                <select
                  value={secretFormData.key}
                  onChange={(e) => setSecretFormData(d => ({ ...d, key: e.target.value }))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select a key...</option>
                  <option value="REXFILL_PROXY_CANISTER_ID">REXFILL_PROXY_CANISTER_ID</option>
                  <option value="PADDLE_ENVIRONMENT">PADDLE_ENVIRONMENT</option>
                  <option value="PADDLE_API_KEY_DEV">PADDLE_API_KEY_DEV</option>
                  <option value="PADDLE_API_KEY_PROD">PADDLE_API_KEY_PROD</option>
                  <option value="PADDLE_WEBHOOK_SECRET_DEV">PADDLE_WEBHOOK_SECRET_DEV</option>
                  <option value="PADDLE_WEBHOOK_SECRET_PROD">PADDLE_WEBHOOK_SECRET_PROD</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Value *
              </label>
              {secretFormData.key === 'PADDLE_ENVIRONMENT' ? (
                <select
                  value={secretFormData.value}
                  onChange={(e) => setSecretFormData(d => ({ ...d, value: e.target.value }))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select environment...</option>
                  <option value="DEV">DEV (Sandbox)</option>
                  <option value="PROD">PROD (Production)</option>
                </select>
              ) : (
                <input
                  type={secretFormData.key === 'REXFILL_PROXY_CANISTER_ID' ? 'text' : 'password'}
                  value={secretFormData.value}
                  onChange={(e) => setSecretFormData(d => ({ ...d, value: e.target.value }))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder={
                    secretFormData.key === 'REXFILL_PROXY_CANISTER_ID'
                      ? 'xxxxx-xxxxx-xxxxx-xxxxx-cai'
                      : secretFormData.key.includes('PADDLE_API_KEY') 
                      ? 'Enter your Paddle API key...'
                      : 'Enter secret value...'
                  }
                />
              )}
              {secretFormData.key === 'REXFILL_PROXY_CANISTER_ID' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter the canister ID of your deployed RexfillProxy Motoko canister. Get this from <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">dfx deploy</code> output.
                </p>
              )}
              {secretFormData.key === 'PADDLE_ENVIRONMENT' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select DEV for Paddle Sandbox environment or PROD for Production. This determines which API keys and webhooks are used.
                </p>
              )}
              {secretFormData.key.includes('PADDLE_API_KEY') && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Get your API key from <a href="https://vendors.paddle.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">vendors.paddle.com</a> → Developer Tools → Authentication
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={secretFormData.description}
                onChange={(e) => setSecretFormData(d => ({ ...d, description: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder="Optional description..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSecretDialog(false);
                  setSecretFormData({ key: '', value: '', description: '', version: undefined });
                  setEditingSecret(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSecret}
                disabled={!secretFormData.key || !secretFormData.value || saveSecretMutation.isPending}
              >
                <Key className="w-4 h-4 mr-2" />
                {editingSecret ? 'Update' : 'Save'} Secret
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default DashboardPage;