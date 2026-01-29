import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { setDoc, getDoc, listDocs, deleteDoc } from '@junobuild/core';
import { toast } from 'sonner';
import { Search, Download, Ban, CheckCircle, Settings, Zap, TrendingUp, Award, Trash2, RefreshCw } from 'lucide-react';
import type { UserProfile, SubscriptionData, SubscriptionOverride, SuspendedUser } from '../../../types';
import { SUBSCRIPTION_PLANS } from '../../../config/plans';
import { useAuth } from '../../../contexts';
import { logAdminAction } from '../../../utils/adminLogger';
import { userProfileRepository, subscriptionRepository, organizationRepository, adminRepository } from '../../../dal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Dialog, Button } from '../../../components/ui';

const UsersPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [overrideData, setOverrideData] = useState({
    documentsPerDay: '',
    documentsPerMonth: '',
    maxTemplates: '',
    maxFileSize: '',
    reason: '',
    expiresAt: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [refreshingSubscriptions, setRefreshingSubscriptions] = useState<Set<string>>(new Set());

  // Fetch all user profiles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      return await userProfileRepository.list();
    },
  });

  // Fetch subscriptions
  const { data: subscriptions } = useQuery({
    queryKey: ['admin_subscriptions'],
    queryFn: async () => {
      return await subscriptionRepository.list();
    },
  });

  // Fetch organizations
  const { data: organizations } = useQuery({
    queryKey: ['admin_organizations'],
    queryFn: async () => {
      return await organizationRepository.list();
    },
  });

  // Fetch organization members
  const { data: orgMembers } = useQuery({
    queryKey: ['admin_org_members'],
    queryFn: async () => {
      // Get all members from all organizations
      const orgs = await organizationRepository.list();
      const allMembers = [];
      for (const org of orgs) {
        const members = await organizationRepository.getMembers(org.key);
        allMembers.push(...members);
      }
      return allMembers;
    },
  });

  // Fetch suspended users
  const { data: suspendedUsers } = useQuery({
    queryKey: ['admin_suspended_users'],
    queryFn: async () => {
      return await adminRepository.getSuspendedUsers();
    },
  });

  // Fetch subscription overrides
  const { data: subscriptionOverrides } = useQuery({
    queryKey: ['admin_subscription_overrides'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'subscription_overrides',
      });
      return items;
    },
  });

  // Fetch security events for override history
  const { data: securityEvents } = useQuery({
    queryKey: ['admin_security_events'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'security_events',
      });
      return items;
    },
  });

  // Fetch template counts (metadata only)
  const { data: templateCounts } = useQuery({
    queryKey: ['admin_template_counts'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'templates_meta',
      });
      
      // Count templates per user
      const counts: Record<string, number> = {};
      items.forEach(item => {
        const userId = item.owner;
        if (userId) {
          counts[userId] = (counts[userId] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Suspend user mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      if (!user) return;

      const suspendData: SuspendedUser = {
        userId,
        reason,
        suspendedAt: Date.now(),
        suspendedBy: user.key,
      };

      await setDoc({
        collection: 'suspended_users',
        doc: {
          key: userId,
          data: suspendData,
        },
      });

      await logAdminAction(user.key, 'suspend_user', 'user', userId, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_suspended_users'] });
      setShowSuspendDialog(false);
      setSuspendReason('');
      setSelectedUser(null);
      toast.success(t('admin.users.suspendSuccess', 'User suspended successfully'));
    },
    onError: () => {
      toast.error(t('admin.users.suspendError', 'Failed to suspend user'));
    },
  });

  // Unsuspend user mutation
  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) return;

      // Fetch the suspended user doc to get the version
      const { items } = await listDocs({
        collection: 'suspended_users',
        filter: {
          matcher: {
            key: userId,
          },
        },
      });

      const suspendedDoc = items[0];
      if (!suspendedDoc) {
        throw new Error('Suspended user record not found');
      }

      await deleteDoc({
        collection: 'suspended_users',
        doc: suspendedDoc,
      });

      await logAdminAction(user.key, 'unsuspend_user', 'user', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_suspended_users'] });
      toast.success(t('admin.users.unsuspendSuccess', 'User unsuspended successfully'));
    },
    onError: () => {
      toast.error(t('admin.users.unsuspendError', 'Failed to unsuspend user'));
    },
  });

  // Override subscription mutation
  const overrideMutation = useMutation({
    mutationFn: async (data: SubscriptionOverride) => {
      if (!user) return;

      await setDoc({
        collection: 'subscription_overrides',
        doc: {
          key: data.userId,
          data: {
            ...data,
            createdAt: Date.now(),
            createdBy: user.key,
          },
        },
      });

      await logAdminAction(user.key, 'override_subscription', 'subscription', data.userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_subscription_overrides'] });
      setShowOverrideDialog(false);
      setOverrideData({
        documentsPerDay: '',
        documentsPerMonth: '',
        maxTemplates: '',
        maxFileSize: '',
        reason: '',
        expiresAt: '',
      });
      setSelectedUser(null);
      toast.success(t('admin.users.overrideSuccess', 'Subscription override applied'));
    },
    onError: () => {
      toast.error(t('admin.users.overrideError', 'Failed to apply override'));
    },
  });

  // Get user's subscription
  const getUserSubscription = (userId: string): SubscriptionData | null => {
    const sub = subscriptions?.find(s => s.owner === userId);
    return sub ? (sub.data as SubscriptionData) : null;
  };

  // Get user's organization
  const getUserOrganization = (userId: string) => {
    const member = orgMembers?.find(m => (m.data as any).userId === userId);
    if (!member) return null;
    
    const org = organizations?.find(o => o.key === (member.data as any).organizationId);
    return org ? { name: (org.data as any).name, role: (member.data as any).role } : null;
  };

  // Check if user is suspended
  const isUserSuspended = (userId: string) => {
    return suspendedUsers?.some(s => s.key === userId) || false;
  };

  // Get user's override
  const getUserOverride = (userId: string): SubscriptionOverride | null => {
    const override = subscriptionOverrides?.find(s => s.key === userId);
    return override ? (override.data as SubscriptionOverride) : null;
  };

  // Get override history for user
  const getOverrideHistory = (userId: string) => {
    if (!securityEvents) return [];
    
    return securityEvents
      .filter(event => {
        const key = event.key;
        const parts = key.split('_');
        const eventUserId = parts[1];
        const eventType = parts[2];
        const description = (event.data as any).description || '';
        
        return eventUserId === userId && 
               (eventType === 'admin_action' || description.includes('override'));
      })
      .sort((a, b) => {
        const aTimestamp = parseInt(a.key.split('_')[0]);
        const bTimestamp = parseInt(b.key.split('_')[0]);
        return bTimestamp - aTimestamp;
      })
      .slice(0, 5); // Last 5 events
  };

  // Preset override functions
  const applyPreset = (preset: 'enterprise' | 'double' | 'triple') => {
    const currentSub = selectedUser ? getUserSubscription(selectedUser.key) : null;
    const currentPlan = currentSub?.planId ? SUBSCRIPTION_PLANS[currentSub.planId] : SUBSCRIPTION_PLANS.free;
    
    if (preset === 'enterprise') {
      const enterpriseLimits = SUBSCRIPTION_PLANS.enterprise.limits;
      setOverrideData(d => ({
        ...d,
        documentsPerDay: String(enterpriseLimits.documentsPerDay === -1 ? 1000 : enterpriseLimits.documentsPerDay),
        documentsPerMonth: String(enterpriseLimits.documentsPerMonth === -1 ? 5000 : enterpriseLimits.documentsPerMonth),
        maxTemplates: String(enterpriseLimits.maxTemplates === -1 ? 1000 : enterpriseLimits.maxTemplates),
        maxFileSize: String(enterpriseLimits.maxFileSize / (1024 * 1024)), // Convert to MB
        reason: 'Enterprise-level access granted',
      }));
    } else if (preset === 'double') {
      setOverrideData(d => ({
        ...d,
        documentsPerDay: String(currentPlan.limits.documentsPerDay === -1 ? 1000 : currentPlan.limits.documentsPerDay * 2),
        documentsPerMonth: String(currentPlan.limits.documentsPerMonth === -1 ? 5000 : currentPlan.limits.documentsPerMonth * 2),
        maxTemplates: String(currentPlan.limits.maxTemplates === -1 ? 1000 : currentPlan.limits.maxTemplates * 2),
        maxFileSize: String((currentPlan.limits.maxFileSize / (1024 * 1024)) * 2),
        reason: 'Double current plan limits',
      }));
    } else if (preset === 'triple') {
      setOverrideData(d => ({
        ...d,
        documentsPerDay: String(currentPlan.limits.documentsPerDay === -1 ? 1000 : currentPlan.limits.documentsPerDay * 3),
        documentsPerMonth: String(currentPlan.limits.documentsPerMonth === -1 ? 5000 : currentPlan.limits.documentsPerMonth * 3),
        maxTemplates: String(currentPlan.limits.maxTemplates === -1 ? 1000 : currentPlan.limits.maxTemplates * 3),
        maxFileSize: String((currentPlan.limits.maxFileSize / (1024 * 1024)) * 3),
        reason: 'Triple current plan limits',
      }));
    }
  };

  // Remove override mutation
  const removeOverrideMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) return;

      const overrideDoc = subscriptionOverrides?.find(s => s.key === userId);
      if (!overrideDoc) throw new Error('Override not found');

      await deleteDoc({
        collection: 'subscription_overrides',
        doc: overrideDoc,
      });

      await logAdminAction(user.key, 'remove_override', 'subscription', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_subscription_overrides'] });
      toast.success('Override removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove override');
    },
  });

  // Filter users
  const filteredUsers = users?.filter(item => {
    if (!searchQuery) return true;
    
    const data = item.data as any;
    const query = searchQuery.toLowerCase();
    
    return (
      data.email?.toLowerCase().includes(query) ||
      data.displayName?.toLowerCase().includes(query) ||
      item.key.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil((filteredUsers?.length || 0) / pageSize);
  const paginatedUsers = filteredUsers?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export functions
  const exportToCSV = () => {
    if (!filteredUsers) return;

    const headers = ['Principal ID', 'Display Name', 'Email', 'Plan', 'Organization', 'Templates', 'Suspended'];
    const rows = filteredUsers.map(item => {
      const data = item.data as any;
      const sub = getUserSubscription(item.key);
      const org = getUserOrganization(item.key);
      
      return [
        item.key,
        data.displayName || '',
        data.email || '',
        sub?.planId || 'free',
        org?.name || '',
        templateCounts?.[item.key] || 0,
        isUserSuspended(item.key) ? 'Yes' : 'No',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!filteredUsers) return;

    const data = filteredUsers.map(item => ({
      principalId: item.key,
      profile: item.data,
      subscription: getUserSubscription(item.key),
      organization: getUserOrganization(item.key),
      templateCount: templateCounts?.[item.key] || 0,
      suspended: isUserSuspended(item.key),
    }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSuspend = (userItem: UserProfile) => {
    setSelectedUser(userItem);
    setShowSuspendDialog(true);
  };

  const handleOverride = (userItem: UserProfile) => {
    setSelectedUser(userItem);
    setShowOverrideDialog(true);
  };

  const handleSaveSuspend = () => {
    if (!selectedUser || !suspendReason.trim()) return;
    suspendMutation.mutate({ userId: selectedUser.key, reason: suspendReason });
  };

  const handleSaveOverride = () => {
    if (!selectedUser || !overrideData.reason.trim()) return;

    const override: SubscriptionOverride = {
      userId: selectedUser.key,
      overrideQuotas: {
        ...(overrideData.documentsPerDay && { documentsPerDay: parseInt(overrideData.documentsPerDay) }),
        ...(overrideData.documentsPerMonth && { documentsPerMonth: parseInt(overrideData.documentsPerMonth) }),
        ...(overrideData.maxTemplates && { maxTemplates: parseInt(overrideData.maxTemplates) }),
        ...(overrideData.maxFileSize && { maxFileSize: parseInt(overrideData.maxFileSize) }),
      },
      reason: overrideData.reason,
      ...(overrideData.expiresAt && { expiresAt: new Date(overrideData.expiresAt).getTime() }),
      createdAt: Date.now(),
      createdBy: user?.key || '',
    };

    overrideMutation.mutate(override);
  };

  // Refresh subscription from Paddle API
  const handleRefreshSubscription = async (userId: string, _subscriptionId: string) => {
    if (refreshingSubscriptions.has(userId)) return;

    setRefreshingSubscriptions(prev => new Set(prev).add(userId));

    try {
      // Get current subscription document
      const currentDoc = await getDoc({
        collection: 'subscriptions',
        key: userId,
      });

      if (!currentDoc) {
        toast.error('Subscription not found');
        setRefreshingSubscriptions(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        return;
      }

      // Update document with needsRefresh flag to trigger onSetDoc hook
      await setDoc({
        collection: 'subscriptions',
        doc: {
          key: userId,
          data: {
            ...(currentDoc.data as SubscriptionData),
            needsRefresh: true,
            lastSyncAttempt: Date.now(),
          },
        },
      });

      console.log('[ADMIN_REFRESH] Triggered subscription refresh for user:', userId);
      toast.loading('Refreshing subscription from Paddle...');

      // Wait for hook to process, then refresh the query
      setTimeout(async () => {
        queryClient.invalidateQueries({ queryKey: ['admin_subscriptions'] });
        
        // Check if refresh was successful
        const updatedDoc = await getDoc({
          collection: 'subscriptions',
          key: userId,
        });
        
        if (updatedDoc) {
          const data = updatedDoc.data as SubscriptionData & { lastSyncError?: string };
          
          if (data.lastSyncError) {
            toast.error(`Refresh failed: ${data.lastSyncError}`);
          } else if (!data.needsRefresh) {
            toast.success(`Subscription refreshed for user ${userId.substring(0, 8)}...`);
          }
        }
        
        setRefreshingSubscriptions(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 2000); // Wait 2 seconds for hook processing

    } catch (error: any) {
      console.error('[ADMIN_REFRESH_SUBSCRIPTION] Error:', error);
      toast.error('Failed to refresh subscription');
    } finally {
      setRefreshingSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('admin.users.title', 'Users')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('admin.users.subtitle', 'Manage user accounts and permissions')}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToJSON}>
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.users.stats.total', 'Total Users')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {users?.length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.users.stats.suspended', 'Suspended')}
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {suspendedUsers?.length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.users.stats.templates', 'Total Templates')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {Object.values(templateCounts || {}).reduce((a, b) => a + b, 0)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder={t('admin.users.search', 'Search by email, name, or Principal ID...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
        />
      </div>

      {/* Users table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.user', 'User')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.plan', 'Plan')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.organization', 'Organization')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.templates', 'Templates')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.status', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.users.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedUsers?.map(item => {
                const data = item.data as any;
                const sub = getUserSubscription(item.key);
                const org = getUserOrganization(item.key);
                const suspended = isUserSuspended(item.key);

                return (
                  <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {data.displayName || t('admin.users.unnamed', 'Unnamed User')}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {data.email || item.key.substring(0, 20) + '...'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {sub?.planId || 'free'}
                        </span>
                        {sub?.paddleSubscriptionId && (
                          <button
                            onClick={() => handleRefreshSubscription(item.key, sub.paddleSubscriptionId!)}
                            disabled={refreshingSubscriptions.has(item.key)}
                            className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh subscription from Paddle API"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingSubscriptions.has(item.key) ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {org ? (
                        <div>
                          <div>{org.name}</div>
                          <div className="text-xs text-slate-500">({org.role})</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {templateCounts?.[item.key] || 0}
                    </td>
                    <td className="px-4 py-3">
                      {suspended ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <Ban className="w-3 h-3 mr-1" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {suspended ? (
                          <button
                            onClick={() => unsuspendMutation.mutate(item.key)}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
                            disabled={unsuspendMutation.isPending}
                          >
                            {t('admin.users.unsuspend', 'Unsuspend')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(item)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                          >
                            {t('admin.users.suspend', 'Suspend')}
                          </button>
                        )}
                        <button
                          onClick={() => handleOverride(item)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                        >
                          <Settings className="w-4 h-4" />
                          {t('admin.users.override', 'Override')}
                        </button>
                      </div>
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
              {Math.min(currentPage * pageSize, filteredUsers?.length || 0)} {t('admin.pagination.of', 'of')}{' '}
              {filteredUsers?.length || 0}
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

      {/* Suspend dialog */}
      {showSuspendDialog && selectedUser && (
        <Dialog
          isOpen={true}
          onClose={() => {
            setShowSuspendDialog(false);
            setSelectedUser(null);
            setSuspendReason('');
          }}
          title={t('admin.users.suspendDialog.title', 'Suspend User')}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('admin.users.suspendDialog.description', 'You are about to suspend')}:{' '}
              <strong>{(selectedUser.data as any).displayName || (selectedUser.data as any).email}</strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.users.suspendDialog.reason', 'Reason')} *
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder={t('admin.users.suspendDialog.reasonPlaceholder', 'Enter reason for suspension...')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuspendDialog(false);
                  setSelectedUser(null);
                  setSuspendReason('');
                }}
              >
                {t('admin.users.suspendDialog.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleSaveSuspend}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                <Ban className="w-4 h-4 mr-2" />
                {t('admin.users.suspendDialog.confirm', 'Suspend User')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Override dialog */}
      {showOverrideDialog && selectedUser && (() => {
        const currentSub = getUserSubscription(selectedUser.key);
        const currentPlan = currentSub?.planId ? SUBSCRIPTION_PLANS[currentSub.planId] : SUBSCRIPTION_PLANS.free;
        const existingOverride = getUserOverride(selectedUser.key);
        const overrideHistory = getOverrideHistory(selectedUser.key);
        
        return (
          <Dialog
            isOpen={true}
            onClose={() => {
              setShowOverrideDialog(false);
              setSelectedUser(null);
              setOverrideData({
                documentsPerDay: '',
                documentsPerMonth: '',
                maxTemplates: '',
                maxFileSize: '',
                reason: '',
                expiresAt: '',
              });
            }}
            title={t('admin.users.overrideDialog.title', 'Subscription Override')}
          >
            <div className="space-y-6 max-h-150 overflow-y-auto">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.users.overrideDialog.description', 'Set custom quota limits for')}:{' '}
                <strong>{(selectedUser.data as any).displayName || (selectedUser.data as any).email}</strong>
              </p>

              {/* Preset Buttons */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Quick Presets
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyPreset('enterprise')}
                    className="flex-1 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    Grant Enterprise
                  </button>
                  <button
                    onClick={() => applyPreset('double')}
                    className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Double Limits
                  </button>
                  <button
                    onClick={() => applyPreset('triple')}
                    className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Triple Limits
                  </button>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Current vs New Limits</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Documents/Day:</span>
                    <span>
                      <span className="text-slate-900 dark:text-white">{currentPlan.limits.documentsPerDay === -1 ? '∞' : currentPlan.limits.documentsPerDay}</span>
                      {overrideData.documentsPerDay && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          → {overrideData.documentsPerDay}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Documents/Month:</span>
                    <span>
                      <span className="text-slate-900 dark:text-white">{currentPlan.limits.documentsPerMonth === -1 ? '∞' : currentPlan.limits.documentsPerMonth}</span>
                      {overrideData.documentsPerMonth && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          → {overrideData.documentsPerMonth}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Max Templates:</span>
                    <span>
                      <span className="text-slate-900 dark:text-white">{currentPlan.limits.maxTemplates === -1 ? '∞' : currentPlan.limits.maxTemplates}</span>
                      {overrideData.maxTemplates && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          → {overrideData.maxTemplates}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Max File Size:</span>
                    <span>
                      <span className="text-slate-900 dark:text-white">{(currentPlan.limits.maxFileSize / (1024 * 1024)).toFixed(0)} MB</span>
                      {overrideData.maxFileSize && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          → {overrideData.maxFileSize} MB
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Override Badge */}
              {existingOverride && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Active Override
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {existingOverride.expiresAt 
                        ? `Expires: ${new Date(existingOverride.expiresAt).toLocaleDateString()}`
                        : 'No expiration'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeOverrideMutation.mutate(selectedUser.key)}
                    className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"
                    disabled={removeOverrideMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              )}

              {/* Override History Panel */}
              {overrideHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recent History</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {overrideHistory.map((event, idx) => {
                      const timestamp = parseInt(event.key.split('_')[0]);
                      const description = (event.data as any).description || '';
                      const messageMatch = description.match(/message:([^;]+)/);
                      const message = messageMatch ? messageMatch[1] : 'Override event';
                      
                      return (
                        <div key={idx} className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded">
                          <div className="text-slate-600 dark:text-slate-400">{message}</div>
                          <div className="text-slate-500 dark:text-slate-500 mt-0.5">
                            {new Date(timestamp).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Override Form */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('admin.users.overrideDialog.documentsPerDay', 'Documents/Day')}
                  </label>
                  <input
                    type="number"
                    value={overrideData.documentsPerDay}
                    onChange={(e) => setOverrideData(d => ({ ...d, documentsPerDay: e.target.value }))}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('admin.users.overrideDialog.documentsPerMonth', 'Documents/Month')}
                  </label>
                  <input
                    type="number"
                    value={overrideData.documentsPerMonth}
                    onChange={(e) => setOverrideData(d => ({ ...d, documentsPerMonth: e.target.value }))}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('admin.users.overrideDialog.maxTemplates', 'Max Templates')}
                  </label>
                  <input
                    type="number"
                    value={overrideData.maxTemplates}
                    onChange={(e) => setOverrideData(d => ({ ...d, maxTemplates: e.target.value }))}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('admin.users.overrideDialog.maxFileSize', 'Max File Size (MB)')}
                  </label>
                  <input
                    type="number"
                    value={overrideData.maxFileSize}
                    onChange={(e) => setOverrideData(d => ({ ...d, maxFileSize: e.target.value }))}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('admin.users.overrideDialog.expiresAt', 'Expires At (optional)')}
                </label>
                <input
                  type="date"
                  value={overrideData.expiresAt}
                  onChange={(e) => setOverrideData(d => ({ ...d, expiresAt: e.target.value }))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('admin.users.overrideDialog.reason', 'Reason')} *
                </label>
                <textarea
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData(d => ({ ...d, reason: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder={t('admin.users.overrideDialog.reasonPlaceholder', 'Enter reason for override...')}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOverrideDialog(false);
                    setSelectedUser(null);
                    setOverrideData({
                      documentsPerDay: '',
                      documentsPerMonth: '',
                      maxTemplates: '',
                      maxFileSize: '',
                      reason: '',
                      expiresAt: '',
                    });
                  }}
                >
                  {t('admin.users.overrideDialog.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={handleSaveOverride}
                  disabled={!overrideData.reason.trim() || overrideMutation.isPending}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {t('admin.users.overrideDialog.save', 'Save Override')}
                </Button>
              </div>
            </div>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default UsersPage;
