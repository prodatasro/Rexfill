import { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ActivityLogData } from '../../types';
import { fetchAllLogs, downloadLogCSV, generateLogCSV } from '../../utils/activityLogger';
import LoadingSpinner from '../ui/LoadingSpinner';

interface ActivityLogViewerProps {
  className?: string;
}

const ITEMS_PER_PAGE = 10;

export const ActivityLogViewer: FC<ActivityLogViewerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const allLogDocs = await fetchAllLogs();
        const allLogs = allLogDocs.map(doc => doc.data);
        setLogs(allLogs);
      } catch (error) {
        console.error('Failed to load activity logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  // Filter logs based on search and filters
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.resource_name.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.resource_type.toLowerCase().includes(query) ||
          log.modified_by.toLowerCase().includes(query)
      );
    }

    // Action filter
    if (selectedActions.size > 0) {
      filtered = filtered.filter((log) => selectedActions.has(log.action));
    }

    // Resource type filter
    if (selectedResourceTypes.size > 0) {
      filtered = filtered.filter((log) => selectedResourceTypes.has(log.resource_type));
    }

    // Date range filter
    if (dateFrom) {
      const fromTimestamp = new Date(dateFrom).getTime();
      filtered = filtered.filter((log) => log.timestamp >= fromTimestamp);
    }
    if (dateTo) {
      const toTimestamp = new Date(dateTo).setHours(23, 59, 59, 999);
      filtered = filtered.filter((log) => log.timestamp <= toTimestamp);
    }

    return filtered;
  }, [logs, searchQuery, selectedActions, selectedResourceTypes, dateFrom, dateTo]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const visibleLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedActions, selectedResourceTypes, dateFrom, dateTo]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleDownloadCSV = useCallback(() => {
    const logs = filteredLogs.map((log, index) => ({
      key: `log_${index}`,
      data: log,
      owner: 'system',
      created_at: BigInt(log.timestamp * 1000000),
      updated_at: BigInt(log.timestamp * 1000000),
      version: BigInt(1),
    }));
    const translations = {
      timestamp: t('profile.activityLog.timestamp'),
      action: t('profile.activityLog.action'),
      status: t('profile.activityLog.status'),
      resource: t('profile.activityLog.resourceName'),
      details: 'Details',
      createdBy: 'Created By',
      modifiedBy: 'Modified By',
      error: 'Error',
    };
    const csv = generateLogCSV(logs, translations);
    downloadLogCSV(csv, 'activity-logs');
  }, [filteredLogs, t]);

  const toggleAction = (action: string) => {
    setSelectedActions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(action)) {
        newSet.delete(action);
      } else {
        newSet.add(action);
      }
      return newSet;
    });
  };

  const toggleResourceType = (type: string) => {
    setSelectedResourceTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedActions(new Set());
    setSelectedResourceTypes(new Set());
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery !== '' ||
      selectedActions.size > 0 ||
      selectedResourceTypes.size > 0 ||
      dateFrom !== '' ||
      dateTo !== ''
    );
  }, [searchQuery, selectedActions, selectedResourceTypes, dateFrom, dateTo]);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const uniqueResourceTypes = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.resource_type))).sort();
  }, [logs]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDetails = (log: ActivityLogData): string => {
    let details = '';
    if (log.action === 'renamed' && log.old_value && log.new_value) {
      details = `${log.old_value} → ${log.new_value}`;
    } else if (log.action === 'moved' && log.old_value && log.new_value) {
      details = `${log.old_value} → ${log.new_value}`;
    } else if (log.file_size !== undefined) {
      details = `${formatFileSize(log.file_size)}`;
    }
    if (log.folder_path) {
      details += details ? ` (${log.folder_path})` : log.folder_path;
    }
    return details || '-';
  };

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        {t('profile.activityLog.success')}
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        {t('profile.activityLog.failed')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header and controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {t('profile.activityLog.title')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredLogs.length > 0 
              ? t('profile.activityLog.showingRange', { 
                  start: (currentPage - 1) * ITEMS_PER_PAGE + 1, 
                  end: Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length), 
                  total: filteredLogs.length 
                })
              : t('profile.activityLog.showing', { count: 0, total: 0 })}
          </p>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-800 dark:text-red-200 font-semibold rounded-xl transition-colors"
            >
              <X size={16} />
              {t('profile.activityLog.resetFilters')}
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            <Filter size={16} />
            {t('profile.activityLog.filters')}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            <FileDown size={16} />
            {t('profile.activityLog.downloadCSV')}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('profile.activityLog.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('profile.activityLog.dateFrom')}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('profile.activityLog.dateTo')}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50"
              />
            </div>
          </div>

          {/* Action type filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.activityLog.actionType')}
            </label>
            <div className="flex flex-wrap gap-2">
              {uniqueActions.map((action) => (
                <button
                  key={action}
                  onClick={() => toggleAction(action)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    selectedActions.has(action)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Resource type filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('profile.activityLog.resourceType')}
            </label>
            <div className="flex flex-wrap gap-2">
              {uniqueResourceTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleResourceType(type)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    selectedResourceTypes.has(type)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Blockchain disclaimer */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          ⚠️ {t('profile.activityLog.blockchainDisclaimer')}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.timestamp')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.action')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.resourceType')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.resourceName')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.details')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('profile.activityLog.status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {visibleLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  {t('profile.activityLog.noLogs')}
                </td>
              </tr>
            ) : (
              visibleLogs.map((log, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {log.resource_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {log.resource_name}
                    {log.error_message && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {log.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {formatDetails(log)}
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(log.success)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 rounded-b-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">{t('profile.activityLog.previous')}</span>
              <span className="sm:hidden">{t('profile.activityLog.previousShort')}</span>
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {t('profile.activityLog.next')}
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {t('profile.activityLog.pageOf', { current: currentPage, total: totalPages })}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-2.5 sm:px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
