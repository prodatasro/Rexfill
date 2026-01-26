import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Building2, Users } from 'lucide-react';

const OrganizationsPage: FC = () => {
  const { t } = useTranslation();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['admin_organizations'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'organizations',
      });
      return items;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['admin_org_members'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'organization_members',
      });
      return items;
    },
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
          {t('admin.organizations.title', 'Organizations')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('admin.organizations.subtitle', 'Manage organization accounts')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.organizations.stats.total', 'Total Organizations')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {organizations?.length || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.organizations.stats.members', 'Total Members')}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {members?.length || 0}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.organizations.table.name', 'Name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.organizations.table.members', 'Members')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.organizations.table.seats', 'Seats')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.organizations.table.created', 'Created')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {organizations?.map(org => {
                const data = org.data as any;
                const orgMembers = members?.filter(m => (m.data as any).organizationId === org.key) || [];
                return (
                  <tr key={org.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {data.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users className="w-4 h-4" />
                        {orgMembers.length}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.seatsUsed || 0} / {data.seatsIncluded || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '-'}
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

export default OrganizationsPage;
