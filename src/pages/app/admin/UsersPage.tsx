import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDocs, setDoc, deleteDoc } from '@junobuild/core';
import { toast } from 'sonner';
import { Search, Download, Ban, CheckCircle, Settings } from 'lucide-react';
import type { UserProfile, SubscriptionData, SubscriptionOverride, SuspendedUser } from '../../../types';
import { useAuth } from '../../../contexts';
import { logAdminAction } from '../../../utils/adminLogger';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Dialog, Button } from '../../../components/ui';

const UsersPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ key: string; data: UserProfile } | null>(null);
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

  // Fetch all user profiles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'user_profiles',
      });
      return items;
    },
  });

  // Fetch subscriptions
  const { data: subscriptions } = useQuery({
    queryKey: ['admin_subscriptions'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'subscriptions',
      });
      return items;
    },
  });

  // Fetch organizations
  const { data: organizations } = useQuery({
    queryKey: ['admin_organizations'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'organizations',
      });
      return items;
    },
  });

  // Fetch organization members
  const { data: orgMembers } = useQuery({
    queryKey: ['admin_org_members'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'organization_members',
      });
      return items;
    },
  });

  // Fetch suspended users
  const { data: suspendedUsers } = useQuery({
    queryKey: ['admin_suspended_users'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'suspended_users',
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

  const handleSuspend = (userItem: { key: string; data: UserProfile }) => {
    setSelectedUser(userItem);
    setShowSuspendDialog(true);
  };

  const handleOverride = (userItem: { key: string; data: UserProfile }) => {
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
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {sub?.planId || 'free'}
                      </span>
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
                            onClick={() => handleSuspend({ key: item.key, data: item.data as UserProfile })}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                          >
                            {t('admin.users.suspend', 'Suspend')}
                          </button>
                        )}
                        <button
                          onClick={() => handleOverride({ key: item.key, data: item.data as UserProfile })}
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
      {showOverrideDialog && selectedUser && (
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
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('admin.users.overrideDialog.description', 'Set custom quota limits for')}:{' '}
              <strong>{(selectedUser.data as any).displayName || (selectedUser.data as any).email}</strong>
            </p>

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

            <div className="flex justify-end gap-2">
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
      )}
    </div>
  );
};

export default UsersPage;
