import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDocs, setDoc, deleteDoc } from '@junobuild/core';
import { toast } from 'sonner';
import { ShieldCheck, Plus, Trash2 } from 'lucide-react';
import type { PlatformAdmin } from '../../../types';
import { useAuth } from '../../../contexts';
import { logAdminAction } from '../../../utils/adminLogger';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Dialog, Button } from '../../../components/ui';

const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin_platform_admins'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'platform_admins',
      });
      return items;
    },
  });

  const { data: adminActions } = useQuery({
    queryKey: ['admin_my_actions'],
    queryFn: async () => {
      if (!user) return [];
      const { items } = await listDocs({
        collection: 'admin_actions',
      });
      return items
        .filter(item => (item.data as any).adminId === user.key)
        .sort((a, b) => (b.data as any).timestamp - (a.data as any).timestamp)
        .slice(0, 50);
    },
    enabled: !!user,
  });

  const addAdminMutation = useMutation({
    mutationFn: async (principalId: string) => {
      if (!user) return;

      const adminData: PlatformAdmin = {
        principalId,
        addedAt: Date.now(),
        addedBy: user.key,
      };

      await setDoc({
        collection: 'platform_admins',
        doc: {
          key: principalId,
          data: adminData,
        },
      });

      await logAdminAction(user.key, 'add_admin', 'admin', principalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_platform_admins'] });
      setShowAddDialog(false);
      setNewAdminId('');
      toast.success(t('admin.settings.addSuccess', 'Admin added successfully'));
    },
    onError: () => {
      toast.error(t('admin.settings.addError', 'Failed to add admin'));
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (principalId: string) => {
      if (!user) return;

      // Prevent removing last admin
      if (admins && admins.length === 1) {
        throw new Error('Cannot remove last admin');
      }

      const adminDoc = admins?.find(a => a.key === principalId);
      if (!adminDoc) {
        throw new Error('Admin not found');
      }

      await deleteDoc({
        collection: 'platform_admins',
        doc: adminDoc,
      });

      await logAdminAction(user.key, 'remove_admin', 'admin', principalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_platform_admins'] });
      toast.success(t('admin.settings.removeSuccess', 'Admin removed successfully'));
    },
    onError: (error: any) => {
      if (error.message === 'Cannot remove last admin') {
        toast.error(t('admin.settings.cannotRemoveLastAdmin', 'Cannot remove the last admin'));
      } else {
        toast.error(t('admin.settings.removeError', 'Failed to remove admin'));
      }
    },
  });

  const handleAddAdmin = () => {
    if (!newAdminId.trim()) return;
    addAdminMutation.mutate(newAdminId);
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
            {t('admin.settings.title', 'Admin Settings')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('admin.settings.subtitle', 'Manage admin users and permissions')}
          </p>
        </div>
        
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.settings.addAdmin', 'Add Admin')}
        </Button>
      </div>

      {/* Admins list */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {t('admin.settings.adminUsers', 'Admin Users')}
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {admins?.map(admin => {
            const data = admin.data as PlatformAdmin;
            return (
              <div key={admin.key} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {admin.key}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Added {new Date(data.addedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => removeAdminMutation.mutate(admin.key)}
                  disabled={removeAdminMutation.isPending || (admins.length === 1)}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('admin.settings.remove', 'Remove')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin actions history */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('admin.settings.yourActions', 'Your Recent Actions')}
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

      {/* Add admin dialog */}
      {showAddDialog && (
        <Dialog
          isOpen={true}
          onClose={() => {
            setShowAddDialog(false);
            setNewAdminId('');
          }}
          title={t('admin.settings.addAdminDialog.title', 'Add Admin User')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.settings.addAdminDialog.principalId', 'Principal ID')} *
              </label>
              <input
                type="text"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder={t('admin.settings.addAdminDialog.placeholder', 'Enter Principal ID...')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewAdminId('');
                }}
              >
                {t('admin.settings.addAdminDialog.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleAddAdmin}
                disabled={!newAdminId.trim() || addAdminMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('admin.settings.addAdminDialog.add', 'Add Admin')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default SettingsPage;
