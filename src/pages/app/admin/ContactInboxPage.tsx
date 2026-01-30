import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Search, Download, Reply, Check } from 'lucide-react';
import type { ContactSubmission } from '../../../types';
import { useAuth } from '../../../contexts';
import { logAdminAction } from '../../../utils/adminLogger';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Dialog, Button } from '../../../components/ui';
import { contactSubmissionRepository } from '../../../dal';

type StatusFilter = 'all' | 'new' | 'read' | 'replied';

const ContactInboxPage: FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<{ key: string; data: ContactSubmission } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Fetch all contact submissions
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['contact_submissions'],
    queryFn: async () => {
      return await contactSubmissionRepository.listAllSorted();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (key: string) => {
      await contactSubmissionRepository.markAsRead(key);

      if (user) {
        await logAdminAction(user.key, 'mark_contact_read', 'contact_submission', key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_submissions'] });
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ key, reply }: { key: string; reply: string }) => {
      if (!user) return;

      await contactSubmissionRepository.addReply(key, reply, user.key);
      await logAdminAction(user.key, 'reply_contact', 'contact_submission', key, { reply });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_submissions'] });
      setSelectedSubmission(null);
      setReplyText('');
      toast.success(t('admin.contactInbox.replySuccess', 'Reply saved successfully'));
    },
    onError: () => {
      toast.error(t('admin.contactInbox.replyError', 'Failed to save reply'));
    },
  });

  // Filter and search submissions
  const filteredSubmissions = submissions?.filter(item => {
    const data = item.data as ContactSubmission;
    
    // Status filter
    if (statusFilter !== 'all' && data.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        data.email.toLowerCase().includes(query) ||
        data.subject.toLowerCase().includes(query) ||
        data.name.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil((filteredSubmissions?.length || 0) / pageSize);
  const paginatedSubmissions = filteredSubmissions?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export functions
  const exportToCSV = () => {
    if (!filteredSubmissions) return;

    const headers = ['Name', 'Email', 'Subject', 'Message', 'Status', 'Submitted At', 'Reply'];
    const rows = filteredSubmissions.map(item => {
      const data = item.data as ContactSubmission;
      return [
        data.name,
        data.email,
        data.subject,
        data.message.replace(/\n/g, ' '),
        data.status,
        new Date(data.submittedAt).toISOString(),
        data.reply || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!filteredSubmissions) return;

    const data = filteredSubmissions.map(item => item.data);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReply = (submission: { key: string; data: ContactSubmission }) => {
    setSelectedSubmission(submission);
    setReplyText(submission.data.reply || '');
    if (submission.data.status === 'new') {
      markAsReadMutation.mutate(submission.key);
    }
  };

  const handleSaveReply = () => {
    if (!selectedSubmission || !replyText.trim()) return;
    replyMutation.mutate({ key: selectedSubmission.key, reply: replyText });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const statusCounts = {
    all: submissions?.length || 0,
    new: submissions?.filter(s => (s.data as ContactSubmission).status === 'new').length || 0,
    read: submissions?.filter(s => (s.data as ContactSubmission).status === 'read').length || 0,
    replied: submissions?.filter(s => (s.data as ContactSubmission).status === 'replied').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('admin.contactInbox.title', 'Contact Inbox')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('admin.contactInbox.subtitle', 'Manage contact form submissions')}
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

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(['all', 'new', 'read', 'replied'] as StatusFilter[]).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === status
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(`admin.contactInbox.status.${status}`, status.charAt(0).toUpperCase() + status.slice(1))}
            <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder={t('admin.contactInbox.search', 'Search by email, subject, or name...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
        />
      </div>

      {/* Submissions table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.status', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.name', 'Name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.email', 'Email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.subject', 'Subject')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.submitted', 'Submitted')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  {t('admin.contactInbox.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedSubmissions?.map(item => {
                const data = item.data as ContactSubmission;
                return (
                  <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          data.status === 'new'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : data.status === 'read'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {data.status === 'replied' && <Check className="w-3 h-3 mr-1" />}
                        {data.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {data.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {data.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {data.subject}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(data.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReply({ key: item.key, data })}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                      >
                        <Reply className="w-4 h-4" />
                        {t('admin.contactInbox.reply', 'Reply')}
                      </button>
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
              {Math.min(currentPage * pageSize, filteredSubmissions?.length || 0)} {t('admin.pagination.of', 'of')}{' '}
              {filteredSubmissions?.length || 0}
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

      {/* Reply dialog */}
      {selectedSubmission && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedSubmission(null)}
          title={t('admin.contactInbox.replyDialog.title', 'Reply to Contact Submission')}
        >
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.contactInbox.replyDialog.from', 'From')}:
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {selectedSubmission.data.name} ({selectedSubmission.data.email})
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.contactInbox.replyDialog.subject', 'Subject')}:
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {selectedSubmission.data.subject}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.contactInbox.replyDialog.message', 'Message')}:
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg whitespace-pre-wrap">
                {selectedSubmission.data.message}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.contactInbox.replyDialog.yourReply', 'Your Reply')}:
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder={t('admin.contactInbox.replyDialog.placeholder', 'Type your reply here...')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                {t('admin.contactInbox.replyDialog.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleSaveReply}
                disabled={!replyText.trim() || replyMutation.isPending}
              >
                <Mail className="w-4 h-4 mr-2" />
                {t('admin.contactInbox.replyDialog.save', 'Save Reply')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default ContactInboxPage;
