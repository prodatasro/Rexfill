/**
 * Security Page - Admin Dashboard
 * 
 * Real-time security monitoring dashboard with:
 * - Security events feed with pagination
 * - Quota violation charts
 * - Rate limit hit frequency graphs
 * - Admin notifications inbox
 * - Suspicious activity panel
 * - Export to CSV functionality
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocs } from '@junobuild/core';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Download,
  Filter,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Button } from '../../../components/ui';

interface SecurityEvent {
  eventType: string;
  severity: 'critical' | 'warning' | 'info';
  userId: string;
  endpoint: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

const SecurityPage: FC = () => {
  useTranslation();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const pageSize = 100;

  // Fetch security events
  const { data: securityEvents, isLoading, refetch } = useQuery({
    queryKey: ['admin_security_events', dateRange],
    queryFn: async () => {
      const now = Date.now();
      let startTime = 0;
      
      if (dateRange === '24h') startTime = now - 24 * 60 * 60 * 1000;
      else if (dateRange === '7d') startTime = now - 7 * 24 * 60 * 60 * 1000;
      else if (dateRange === '30d') startTime = now - 30 * 24 * 60 * 60 * 1000;

      const { items } = await listDocs({
        collection: 'security_events',
      });

      // Parse events from keys and description
      const events: SecurityEvent[] = items
        .map(item => {
          const key = item.key;
          const parts = key.split('_');
          const timestamp = parseInt(parts[0]);
          const userId = parts[1];
          const eventType = parts[2];
          
          // Parse description for severity and message
          const description = (item.data as any).description || '';
          const severityMatch = description.match(/severity:(critical|warning|info);/);
          const severity = severityMatch ? severityMatch[1] as 'critical' | 'warning' | 'info' : 'info';
          const messageMatch = description.match(/message:([^;]+)/);
          const message = messageMatch ? messageMatch[1] : '';
          
          return {
            eventType,
            severity,
            userId,
            endpoint: (item.data as any).endpoint || '',
            message,
            metadata: (item.data as any).metadata,
            timestamp,
          };
        })
        .filter(event => startTime === 0 || event.timestamp >= startTime)
        .sort((a, b) => b.timestamp - a.timestamp);

      return events;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter by severity
  const filteredEvents = useMemo(() => {
    if (!securityEvents) return [];
    if (selectedSeverity === 'all') return securityEvents;
    return securityEvents.filter(e => e.severity === selectedSeverity);
  }, [securityEvents, selectedSeverity]);

  // Pagination
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredEvents.length / pageSize);

  // Statistics
  const stats = useMemo(() => {
    if (!securityEvents) return { critical: 0, warning: 0, info: 0, quotaViolations: 0, rateLimits: 0 };
    
    return {
      critical: securityEvents.filter(e => e.severity === 'critical').length,
      warning: securityEvents.filter(e => e.severity === 'warning').length,
      info: securityEvents.filter(e => e.severity === 'info').length,
      quotaViolations: securityEvents.filter(e => e.message.toLowerCase().includes('quota')).length,
      rateLimits: securityEvents.filter(e => e.message.toLowerCase().includes('rate limit')).length,
    };
  }, [securityEvents]);

  // Group events by hour for chart
  const hourlyData = useMemo(() => {
    if (!securityEvents) return [];
    
    const groups: Record<string, number> = {};
    securityEvents.forEach(event => {
      const hour = new Date(event.timestamp).toISOString().slice(0, 13);
      groups[hour] = (groups[hour] || 0) + 1;
    });
    
    return Object.entries(groups)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-24); // Last 24 hours
  }, [securityEvents]);

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredEvents) return;

    const headers = ['Timestamp', 'Severity', 'User ID', 'Event Type', 'Endpoint', 'Message'];
    const rows = filteredEvents.map(event => [
      new Date(event.timestamp).toISOString(),
      event.severity,
      event.userId,
      event.eventType,
      event.endpoint,
      event.message,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-events-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Security Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Monitor security events and suspicious activity
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} size="sm">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Critical Events</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {stats.critical}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Warnings</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {stats.warning}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Info Events</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.info}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Quota Violations</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.quotaViolations}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Rate Limits</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.rateLimits}
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Hourly Activity (Last 24h)
          </h2>
        </div>
        <div className="h-48 flex items-end gap-1">
          {hourlyData.map((data, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full bg-blue-500 dark:bg-blue-600 rounded-t hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
                style={{
                  height: `${Math.max(10, (data.count / Math.max(...hourlyData.map(d => d.count))) * 100)}%`,
                }}
              />
              <div className="absolute -top-8 hidden group-hover:block bg-slate-900 text-white text-xs px-2 py-1 rounded">
                {data.count} events
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
          Time series of security events
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Severity:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">Period:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Events Feed */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Security Events ({filteredEvents.length})
          </h2>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {paginatedEvents.map((event, index) => (
            <div key={index} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        event.severity === 'critical'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : event.severity === 'warning'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}
                    >
                      {event.severity === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {event.severity}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {event.eventType}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {event.endpoint}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    {event.message}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>User: {event.userId.substring(0, 20)}...</span>
                    <span>{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  
                  {event.metadata && (
                    <button
                      onClick={() => setExpandedEvent(expandedEvent === `${index}` ? null : `${index}`)}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {expandedEvent === `${index}` ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          Hide metadata
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          Show metadata
                        </>
                      )}
                    </button>
                  )}
                  
                  {expandedEvent === `${index}` && event.metadata && (
                    <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded text-xs overflow-x-auto">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityPage;
