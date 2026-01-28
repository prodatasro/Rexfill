import { FC, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import { X, Download, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { formatDateLocal, downloadFile } from '../../utils/dateUtils';
import LoadingSpinner from '../ui/LoadingSpinner';

interface DailyUsageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

interface UserUsage {
  principalId: string;
  userName?: string;
  userEmail?: string;
  documentsProcessed: number;
  templatesUploaded: number;
}

type SortField = 'name' | 'documentsProcessed' | 'templatesUploaded';
type SortDirection = 'asc' | 'desc';

const DailyUsageDetailModal: FC<DailyUsageDetailModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  isAnomaly,
  anomalyReason,
}) => {
  const { t, i18n } = useTranslation();
  const [sortField, setSortField] = useState<SortField>('documentsProcessed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // Fetch usage data for selected date
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['daily_usage_detail', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      
      const { items } = await listDocs({
        collection: 'usage',
        filter: {
          matcher: {
            key: `.*_${selectedDate}$`,
          },
        },
      });
      
      return items;
    },
    enabled: isOpen && !!selectedDate,
  });

  // Fetch user profiles for display
  const { data: userProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['user_profiles_for_usage'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'user_profiles',
      });
      return items;
    },
    enabled: isOpen,
  });

  // Fetch platform admins to exclude from list
  const { data: platformAdmins } = useQuery({
    queryKey: ['platform_admins_for_usage'],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'platform_admins',
      });
      return items;
    },
    enabled: isOpen,
  });

  // Combine usage data with user profiles (excluding admins)
  const userUsageData: UserUsage[] = useMemo(() => {
    if (!usageData || !userProfiles) return [];

    // Create set of admin IDs
    const adminIds = new Set(platformAdmins?.map(admin => admin.key) || []);

    const profileMap = new Map(
      userProfiles.map(profile => [
        profile.key,
        {
          name: (profile.data as any).displayName || 'Unknown User',
          email: (profile.data as any).email || '',
        },
      ])
    );

    return usageData
      .map(usage => {
        // Extract principal ID from key (format: principalId_date)
        const principalId = usage.key.split('_').slice(0, -1).join('_');
        const userInfo = profileMap.get(principalId);

        return {
          principalId,
          userName: userInfo?.name,
          userEmail: userInfo?.email,
          documentsProcessed: (usage.data as any).documentsProcessed || 0,
          templatesUploaded: (usage.data as any).templatesUploaded || 0,
        };
      })
      .filter(user => !adminIds.has(user.principalId)); // Exclude admins from list
  }, [usageData, userProfiles, platformAdmins]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...userUsageData].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        const nameA = a.userName || a.userEmail || a.principalId;
        const nameB = b.userName || b.userEmail || b.principalId;
        comparison = nameA.localeCompare(nameB);
      } else {
        comparison = a[sortField] - b[sortField];
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [userUsageData, sortField, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export handlers
  const handleExport = (format: 'csv' | 'json') => {
    if (!selectedDate || !sortedData.length) return;

    const exportData = sortedData.map(user => ({
      user: user.userName || user.userEmail || user.principalId,
      email: user.userEmail || '',
      documentsProcessed: user.documentsProcessed,
      templatesUploaded: user.templatesUploaded,
    }));

    const dateStr = formatDateLocal(selectedDate, i18n.language);

    if (format === 'csv') {
      const header = 'User,Email,Documents Processed,Templates Uploaded';
      const rows = exportData.map(row => 
        `"${row.user}","${row.email}",${row.documentsProcessed},${row.templatesUploaded}`
      );
      const csv = [header, ...rows].join('\n');
      downloadFile(csv, `daily-usage-${selectedDate}.csv`, 'text/csv');
    } else {
      const json = JSON.stringify({
        date: selectedDate,
        formattedDate: dateStr,
        isAnomaly,
        anomalyReason,
        totalUsers: exportData.length,
        totalDocumentsProcessed: exportData.reduce((sum, u) => sum + u.documentsProcessed, 0),
        totalTemplatesUploaded: exportData.reduce((sum, u) => sum + u.templatesUploaded, 0),
        users: exportData,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      downloadFile(json, `daily-usage-${selectedDate}.json`, 'application/json');
    }
  };

  // Focus trap and escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset page when sorting changes
  useEffect(() => {
    setCurrentPage(0);
  }, [sortField, sortDirection]);

  if (!isOpen || !selectedDate) return null;

  const isLoading = usageLoading || profilesLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {t('admin.dashboard.dailyDetails.title', 'Daily Usage Details')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {t('admin.dashboard.dailyDetails.date', 'Date')}: {formatDateLocal(selectedDate, i18n.language)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Anomaly warning */}
          {isAnomaly && anomalyReason && (
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-orange-900 dark:text-orange-300 text-sm">
                  {t('admin.dashboard.dailyDetails.anomalyWarning', 'Anomaly Detected')}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                  {anomalyReason}
                </div>
              </div>
            </div>
          )}

          {/* Export buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={isLoading || sortedData.length === 0}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={isLoading || sortedData.length === 0}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
              <p className="text-lg mb-2">{t('admin.dashboard.dailyDetails.noData', 'No usage data for this date')}</p>
              <p className="text-sm">No users processed documents or uploaded templates on this day.</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-2 font-semibold text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        >
                          {t('admin.dashboard.dailyDetails.user', 'User')}
                          {sortField === 'name' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                          {t('admin.dashboard.dailyDetails.email', 'Email')}
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSort('documentsProcessed')}
                          className="flex items-center gap-2 ml-auto font-semibold text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        >
                          {t('admin.dashboard.dailyDetails.processed', 'Processed')}
                          {sortField === 'documentsProcessed' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSort('templatesUploaded')}
                          className="flex items-center gap-2 ml-auto font-semibold text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        >
                          {t('admin.dashboard.dailyDetails.uploaded', 'Uploaded')}
                          {sortField === 'templatesUploaded' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedData.map((user) => (
                      <tr key={user.principalId} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {user.userName || user.userEmail || (
                            <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                              {user.principalId.slice(0, 16)}...
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {user.userEmail || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white text-right font-medium">
                          {user.documentsProcessed}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white text-right font-medium">
                          {user.templatesUploaded}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('admin.dashboard.dailyDetails.page', 'Page {{current}} of {{total}}', {
                      current: currentPage + 1,
                      total: totalPages,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyUsageDetailModal;
