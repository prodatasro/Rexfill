import { FC, useState } from 'react';
import { Users, UserPlus, Settings, Crown, Shield, User as UserIcon, Mail, Hash, X, Loader2, AlertTriangle, Download } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { OrganizationRole } from '../../types/organization';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { useTranslation } from 'react-i18next';

const OrganizationSettingsPage: FC = () => {
  const { t } = useTranslation();
  const {
    currentOrganization,
    userRole,
    members,
    pendingInvitations,
    isLoading,
    inviteByEmail,
    inviteByPrincipal,
    removeMember,
    leaveOrganization,
    canInviteMembers,
    canManageMembers,
    availableSeats,
    exportOrganizationData,
  } = useOrganization();

  const { subscription, plan, usage, gracePeriodEndsAt, organizationSubscription } = useSubscription();

  const [inviteType, setInviteType] = useState<'email' | 'principal'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePrincipal, setInvitePrincipal] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('member');
  const [inviting, setInviting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'invitations'>('overview');
  const [exportLoading, setExportLoading] = useState(false);

  const handleSendInvitation = async () => {
    setInviting(true);
    try {
      if (inviteType === 'email') {
        if (!inviteEmail) {
          showErrorToast('Please enter an email address');
          return;
        }
        await inviteByEmail(inviteEmail, inviteRole);
        setInviteEmail('');
      } else {
        if (!invitePrincipal) {
          showErrorToast('Please enter a Principal ID');
          return;
        }
        await inviteByPrincipal(invitePrincipal, inviteRole);
        setInvitePrincipal('');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportOrganizationData();
      showSuccessToast(t('organization.exportSuccess') || 'Data exported successfully');
    } catch (error) {
      console.error('Failed to export data:', error);
      showErrorToast(t('organization.exportError') || 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleIcon = (role: OrganizationRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleBadgeColor = (role: OrganizationRole) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              No Organization
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You're not part of any organization yet. Upgrade to a team plan to create one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {currentOrganization.data.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('organization.manageTeam') || 'Manage your organization settings and team members'}
          </p>
        </div>

        {/* Grace Period Banner */}
        {gracePeriodEndsAt && userRole === 'owner' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  {t('organization.gracePeriod.title')}
                </h3>
                <p className="text-red-800 dark:text-red-200 mb-4">
                  {t('organization.gracePeriod.message', {
                    days: Math.ceil((gracePeriodEndsAt - Date.now()) / (24 * 60 * 60 * 1000)),
                    date: formatDate(gracePeriodEndsAt)
                  })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {t('organization.exportData')}
                      </>
                    )}
                  </button>
                  {organizationSubscription?.paddleSubscriptionId && (
                    <a
                      href={`https://customer-portal.paddle.com/subscriptions/${organizationSubscription.paddleSubscriptionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t('subscription.resubscribe')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'members'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Members ({members.length})
          </button>
          {canInviteMembers() && (
            <button
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'invitations'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Invitations ({pendingInvitations.length})
            </button>
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Subscription Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                Subscription
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Plan</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Seats</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {subscription?.seatsUsed || 0} / {subscription?.seatsIncluded || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Available</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {availableSeats} seat{availableSeats !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                Organization Usage
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Documents Today</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{usage.documentsToday}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Documents This Month</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{usage.documentsThisMonth}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Templates</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{usage.totalTemplates}</p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {userRole !== 'owner' && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 p-6">
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Leave this organization. You'll lose access to all shared templates and data.
                </p>
                <button
                  onClick={leaveOrganization}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Leave Organization
                </button>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                Team Members
              </h2>
              
              {/* Invite Form */}
              {canInviteMembers() && (
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-3">Invite New Member</h3>
                  
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setInviteType('email')}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                        inviteType === 'email'
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email
                    </button>
                    <button
                      onClick={() => setInviteType('principal')}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                        inviteType === 'principal'
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Hash className="w-4 h-4 inline mr-2" />
                      Principal ID
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {inviteType === 'email' ? (
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="member@example.com"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    ) : (
                      <input
                        type="text"
                        value={invitePrincipal}
                        onChange={(e) => setInvitePrincipal(e.target.value)}
                        placeholder="Principal ID"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    )}
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={handleSendInvitation}
                      disabled={inviting || availableSeats <= 0}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {inviting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Inviting...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </>
                      )}
                    </button>
                  </div>
                  
                  {availableSeats <= 0 && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      No available seats. Please upgrade your plan to invite more members.
                    </p>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.key}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {member.data.userId.substring(0, 12)}...
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.data.role)}`}>
                            {getRoleIcon(member.data.role)}
                            {member.data.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManageMembers() && member.data.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(member.key)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && canInviteMembers() && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Pending Invitations
            </h2>

            {pendingInvitations.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                No pending invitations
              </p>
            ) : (
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.key}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {invitation.data.email || invitation.data.principalId}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Role: <span className="font-medium">{invitation.data.role}</span> • 
                        Expires: {new Date(invitation.data.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettingsPage;
