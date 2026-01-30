import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Trash2 } from 'lucide-react';
import type { PlatformAdmin } from '../../../types';
import { useAuth, useAdmin } from '../../../contexts';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { promoteToAdmin, revokeAdmin } from '../../../utils/adminLogger';
import { showSuccessToast, showErrorToast } from '../../../utils/toast';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { adminRepository, adminActionRepository } from '../../../dal';

const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isFirstAdmin, refetchAdmins } = useAdmin();
  const { confirm } = useConfirm();
  const [newAdminId, setNewAdminId] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const { data: admins, isLoading, refetch } = useQuery({
    queryKey: ['admin_platform_admins'],
    queryFn: async () => {
      const items = await adminRepository.list();
      // Sort by addedAt to show first admin first
      return items.sort((a, b) => {
        const aData = a.data as PlatformAdmin;
        const bData = b.data as PlatformAdmin;
        return aData.addedAt - bData.addedAt;
      });
    },
  });

  const { data: adminActions } = useQuery({
    queryKey: ['admin_all_actions'],
    queryFn: async () => {
      // Fetch ALL admin actions (not filtered by current user)
      return await adminActionRepository.listAllSorted(50);
    },
  });

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminId.trim() || !user) return;

    setIsAddingAdmin(true);
    try {
      const result = await promoteToAdmin(user.key, newAdminId.trim());
      
      if (result.success) {
        showSuccessToast('Admin added successfully');
        setNewAdminId('');
        await refetch();
        await refetchAdmins();
      } else {
        showErrorToast(result.error || 'Failed to add admin');
      }
    } catch (error) {
      showErrorToast('Failed to add admin');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (principalId: string) => {
    if (!user) return;

    const confirmed = await confirm({
      title: 'Remove Admin',
      message: 'Are you sure you want to revoke admin access for this user? They will immediately lose access to the admin area.',
      confirmLabel: 'Remove Admin',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const result = await revokeAdmin(user.key, principalId);
      
      if (result.success) {
        showSuccessToast('Admin access revoked');
        await refetch();
        await refetchAdmins();
      } else {
        showErrorToast(result.error || 'Failed to revoke admin access');
      }
    } catch (error) {
      showErrorToast('Failed to revoke admin access');
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
      <div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('admin.settings.title', 'Admin Settings')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('admin.settings.subtitle', 'Manage admin users and permissions')}
          </p>
        </div>
        
        {/* Admin policy notice */}
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {t('admin.settings.adminPolicy.title', 'First Admin Policy')}
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {t('admin.settings.adminPolicy.description', 'The first user who logged in is the primary administrator and can add or remove other admins. The first admin cannot be removed to prevent platform lockout.')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Admin Form - Only visible to first admin */}
      {isFirstAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t('admin.settings.addAdmin', 'Add Admin')}
            </h2>
          </div>
          <form onSubmit={handleAddAdmin} className="p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="principalId" className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                  {t('admin.settings.principalIdLabel', 'User Principal ID')}
                </label>
                <input
                  type="text"
                  id="principalId"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  placeholder={t('admin.settings.principalIdPlaceholder', 'Enter user principal ID')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAddingAdmin}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('admin.settings.principalIdHelp', 'The user must have logged in at least once to have a valid principal ID.')}
                </p>
              </div>
              <button
                type="submit"
                disabled={!newAdminId.trim() || isAddingAdmin}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                {isAddingAdmin ? t('admin.settings.adding', 'Adding...') : t('admin.settings.addAdminButton', 'Add Admin')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admins list */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {t('admin.settings.adminUsers', 'Admin Users')}
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {admins?.map((admin, index) => {
            const data = admin.data as PlatformAdmin;
            const isFirstAdminUser = index === 0;
            const isCurrentUser = user?.key === admin.key;
            const canRemove = isFirstAdmin && !isFirstAdminUser && (admins.length > 1);
            
            return (
              <div key={admin.key} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {admin.key}
                      </div>
                      {isFirstAdminUser && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          {t('admin.settings.firstAdminLabel', 'First Admin')}
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {t('admin.settings.youLabel', 'You')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Added {new Date(data.addedAt).toLocaleDateString()} by {data.addedBy === admin.key ? 'system' : data.addedBy}
                    </div>
                  </div>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveAdmin(admin.key)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('admin.settings.removeAdmin', 'Remove Admin')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            {t('admin.settings.allActions', 'Recent Admin Actions')}
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
                  {t('admin.settings.table.admin', 'Admin')}
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
                    <td className="px-4 py-3 text-xs text-slate-900 dark:text-white font-mono">
                      {data.adminId.substring(0, 12)}...
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
