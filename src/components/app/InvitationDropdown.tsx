import { FC, useState } from 'react';
import { UserPlus, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { InvitationData } from '../../types/organization';

interface InvitationDropdownProps {
  onClose: () => void;
}

const InvitationDropdown: FC<InvitationDropdownProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { userInvitations, acceptInvitation, rejectInvitation } = useOrganization();
  const { notifications, markAsRead } = useNotifications();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleAccept = async (invitationId: string) => {
    setAcceptingId(invitationId);
    try {
      await acceptInvitation(invitationId);
      onClose();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    setRejectingId(invitationId);
    try {
      await rejectInvitation(invitationId);
    } catch (error) {
      console.error('Failed to reject invitation:', error);
    } finally {
      setRejectingId(null);
    }
  };

  const getExpirationStatus = (expiresAt: number) => {
    const now = Date.now();
    const timeLeft = expiresAt - now;
    
    if (timeLeft < 0) {
      return { label: t('invitations.expired'), color: 'text-red-600 dark:text-red-400', icon: AlertCircle };
    } else if (timeLeft < 24 * 60 * 60 * 1000) {
      return { label: t('invitations.expiringSoon'), color: 'text-orange-600 dark:text-orange-400', icon: Clock };
    }
    
    const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
    return { label: t('invitations.expiresIn', { days: daysLeft }), color: 'text-slate-600 dark:text-slate-400', icon: Clock };
  };

  const hasContent = userInvitations.length > 0 || notifications.filter(n => !n.read).length > 0;

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('invitations.notifications')}
        </h3>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {!hasContent ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('invitations.noPending')}
            </p>
          </div>
        ) : (
          <>
            {/* Invitations Section */}
            {userInvitations.length > 0 && (
              <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    {t('invitations.pending')}
                  </h4>
                </div>
                {userInvitations.map((invitation) => {
                  const invData = invitation.data as InvitationData;
                  const expStatus = getExpirationStatus(invData.expiresAt);
                  const ExpirationIcon = expStatus.icon;
                  const isExpired = invData.expiresAt < Date.now();

                  return (
                    <div
                      key={invitation.key}
                      className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-1">
                          <UserPlus className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {t('invitations.invitedTo', { orgName: 'Organization' })}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {t('invitations.role')}: <span className="font-medium capitalize">{invData.role}</span>
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <ExpirationIcon className={`w-3 h-3 ${expStatus.color}`} />
                            <p className={`text-xs ${expStatus.color}`}>
                              {expStatus.label}
                            </p>
                          </div>
                          {!isExpired && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleAccept(invitation.key)}
                                disabled={acceptingId === invitation.key || rejectingId === invitation.key}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors disabled:opacity-50"
                              >
                                {acceptingId === invitation.key ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    {t('invitations.accepting')}
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3" />
                                    {t('invitations.accept')}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleReject(invitation.key)}
                                disabled={acceptingId === invitation.key || rejectingId === invitation.key}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                              >
                                {rejectingId === invitation.key ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                    {t('invitations.rejecting')}
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3 h-3" />
                                    {t('invitations.reject')}
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* General Notifications Section */}
            {notifications.filter(n => !n.read).length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    {t('invitations.otherNotifications')}
                  </h4>
                </div>
                {notifications
                  .filter(n => !n.read)
                  .slice(0, 5)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Import Bell for the empty state
import { Bell } from 'lucide-react';

export default InvitationDropdown;
