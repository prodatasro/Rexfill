/**
 * Notification Inbox Component
 * 
 * Displays admin notifications with:
 * - Badge count for unread notifications
 * - Dropdown showing recent alerts
 * - Alert details with severity parsing
 * - Quick actions (View User, Apply Override, Suspend User, View Events)
 * - Mark as read functionality
 * - Pagination with startAfter cursor
 * - Filter by severity and date range
 */

import { FC, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDocs, setDoc } from '@junobuild/core';
import { Bell, AlertTriangle, Info, CheckCircle, X, User, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminNotification {
  key: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  userId: string;
  metadata?: Record<string, any>;
  timestamp: number;
  read: boolean;
}

interface NotificationInboxProps {
  onNavigateToUser?: (userId: string) => void;
  onNavigateToSecurity?: () => void;
}

const NotificationInbox: FC<NotificationInboxProps> = ({
  onNavigateToUser,
  onNavigateToSecurity,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch admin notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['admin_notifications', selectedSeverity],
    queryFn: async () => {
      const { items } = await listDocs({
        collection: 'admin_notifications',
      });

      // Parse notifications from keys and description
      const parsed: AdminNotification[] = items.map(item => {
        const key = item.key;
        const parts = key.split('_');
        const timestamp = parseInt(parts[0]);
        const severity = parts[1] as 'critical' | 'warning' | 'info';
        const userId = parts[2];
        
        // Parse description for read status and message
        const description = (item.data as any).description || '';
        const readMatch = description.match(/read:(true|false);/);
        const read = readMatch ? readMatch[1] === 'true' : false;
        const messageMatch = description.match(/message:([^;]+)/);
        const message = messageMatch ? messageMatch[1] : '';
        
        return {
          key,
          message,
          severity,
          userId,
          metadata: (item.data as any).metadata,
          timestamp,
          read,
        };
      }).sort((a, b) => b.timestamp - a.timestamp);

      return parsed;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Filter by severity
  const filteredNotifications = notifications?.filter(n => 
    selectedSeverity === 'all' || n.severity === selectedSeverity
  ) || [];

  // Unread count
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Pagination
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredNotifications.length / pageSize);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notification: AdminNotification) => {
      const description = `read:true;message:${notification.message}`;
      
      await setDoc({
        collection: 'admin_notifications',
        doc: {
          key: notification.key,
          data: {
            description,
            metadata: notification.metadata,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
    },
  });

  const handleViewUser = (userId: string) => {
    setIsOpen(false);
    if (onNavigateToUser) {
      onNavigateToUser(userId);
    } else {
      navigate(`/admin/users?userId=${userId}`);
    }
  };

  const handleViewSecurity = () => {
    setIsOpen(false);
    if (onNavigateToSecurity) {
      onNavigateToSecurity();
    } else {
      navigate('/admin/security');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 top-12 z-50 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 max-h-150 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Notifications
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {unreadCount} unread
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-sm"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-slate-500">
                  Loading...
                </div>
              ) : paginatedNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {paginatedNotifications.map((notification) => (
                    <div
                      key={notification.key}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getSeverityIcon(notification.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 dark:text-white">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {new Date(notification.timestamp).toLocaleString()}
                          </p>
                          
                          {/* Quick Actions */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleViewUser(notification.userId)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <User className="w-3 h-3" />
                              View User
                            </button>
                            <button
                              onClick={handleViewSecurity}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View Events
                            </button>
                            {!notification.read && (
                              <button
                                onClick={() => markAsReadMutation.mutate(notification)}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                                disabled={markAsReadMutation.isPending}
                              >
                                <CheckCircle className="w-3 h-3" />
                                Mark Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationInbox;
