import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { getDoc, setDoc, listDocs, deleteDoc } from '@junobuild/core';
import type { Doc } from '@junobuild/core';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useUserProfile } from './UserProfileContext';
import { 
  OrganizationData, 
  OrganizationMemberData, 
  InvitationData, 
  OrganizationRole,
  InvitationStatus
} from '../types/organization';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { logActivity } from '../utils/activityLogger';

interface OrganizationContextType {
  currentOrganization: Doc<OrganizationData> | null;
  userRole: OrganizationRole | null;
  members: Doc<OrganizationMemberData>[];
  pendingInvitations: Doc<InvitationData>[];
  userInvitations: Doc<InvitationData>[]; // Invitations received by the current user
  isLoading: boolean;
  createOrganization: (name: string) => Promise<void>;
  inviteByEmail: (email: string, role: OrganizationRole) => Promise<void>;
  inviteByPrincipal: (principalId: string, role: OrganizationRole) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, newRole: OrganizationRole) => Promise<void>;
  leaveOrganization: () => Promise<void>;
  canInviteMembers: () => boolean;
  canManageMembers: () => boolean;
  availableSeats: number;
  exportOrganizationData: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: FC<OrganizationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { profile } = useUserProfile();
  
  const [currentOrganization, setCurrentOrganization] = useState<Doc<OrganizationData> | null>(null);
  const [userRole, setUserRole] = useState<OrganizationRole | null>(null);
  const [members, setMembers] = useState<Doc<OrganizationMemberData>[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Doc<InvitationData>[]>([]);
  const [userInvitations, setUserInvitations] = useState<Doc<InvitationData>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate available seats
  const availableSeats = currentOrganization && subscription?.seatsIncluded
    ? (subscription.seatsIncluded - (subscription.seatsUsed || 0))
    : 0;

  // Helper function to send email invitations (stub for future email service)
  const sendInvitationEmail = useCallback(async (
    email: string,
    organizationName: string,
    role: OrganizationRole,
    inviterName: string
  ) => {
    // TODO: Implement email sending via email service when available
    console.log(`[Email Service] Invitation email would be sent to ${email} for ${organizationName} (${role}) from ${inviterName}`);
  }, []);

  // Helper function to cleanup expired invitations (>30 days old)
  const cleanupExpiredInvitations = useCallback(async () => {
    if (!user) return;

    try {
      const allInvitations = await listDocs({
        collection: 'organization_invitations',
      });

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expiredInvitations = allInvitations.items.filter(doc => {
        const invitation = doc.data as InvitationData;
        return invitation.expiresAt < Date.now() && invitation.createdAt < thirtyDaysAgo;
      });

      for (const invDoc of expiredInvitations) {
        try {
          await deleteDoc({
            collection: 'organization_invitations',
            doc: invDoc,
          });
        } catch (error) {
          console.error('Failed to delete expired invitation:', error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired invitations:', error);
    }
  }, [user]);

  // Helper function to load user's pending invitations
  const loadUserInvitations = useCallback(async () => {
    if (!user) {
      setUserInvitations([]);
      return;
    }

    try {
      const allInvitations = await listDocs({
        collection: 'organization_invitations',
      });

      // Filter invitations for this user by principalId
      const userInvites = allInvitations.items.filter(doc => {
        const invitation = doc.data as InvitationData;
        return (
          invitation.status === 'pending' &&
          invitation.principalId === user.key
        );
      });

      setUserInvitations(userInvites as Doc<InvitationData>[]);
    } catch (error) {
      console.error('Failed to load user invitations:', error);
    }
  }, [user]);

  // Load organization data
  useEffect(() => {
    const loadOrganizationData = async () => {
      if (!user) {
        setCurrentOrganization(null);
        setUserRole(null);
        setMembers([]);
        setPendingInvitations([]);
        setUserInvitations([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Cleanup expired invitations on user login
        await cleanupExpiredInvitations();

        // Load user's pending invitations
        await loadUserInvitations();

        // Check if user is a member of any organization
        // Since member docs are keyed by ${orgId}_${userId}, we need to list all and filter
        const allMembershipDocs = await listDocs({
          collection: 'organization_members',
        });

        // Filter to find this user's memberships
        const userMemberships = allMembershipDocs.items.filter(doc => {
          const memberData = doc.data as OrganizationMemberData;
          return memberData.userId === user.key;
        });

        if (userMemberships.length === 0) {
          // User is not in any organization
          setCurrentOrganization(null);
          setUserRole(null);
          setMembers([]);
          setPendingInvitations([]);
          setIsLoading(false);
          return;
        }

        // Get the first membership (users can only be in one org for now)
        const membership = userMemberships[0].data as OrganizationMemberData;
        setUserRole(membership.role);

        // Load organization details
        const orgDoc = await getDoc({
          collection: 'organizations',
          key: membership.organizationId,
        });

        if (orgDoc) {
          setCurrentOrganization(orgDoc as Doc<OrganizationData>);

          // Load all organization members
          const allMembersDocs = await listDocs({
            collection: 'organization_members',
          });

          const orgMembers = allMembersDocs.items.filter(
            (doc) => (doc.data as OrganizationMemberData).organizationId === membership.organizationId
          );
          setMembers(orgMembers as Doc<OrganizationMemberData>[]);

          // Load pending invitations (if user is owner or admin)
          if (membership.role === 'owner' || membership.role === 'admin') {
            const invitationDocs = await listDocs({
              collection: 'organization_invitations',
            });

            const orgInvitations = invitationDocs.items.filter(
              (doc) => 
                (doc.data as InvitationData).organizationId === membership.organizationId &&
                (doc.data as InvitationData).status === 'pending'
            );
            setPendingInvitations(orgInvitations as Doc<InvitationData>[]);
          }
        }
      } catch (error) {
        console.error('Failed to load organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizationData();
  }, [user]);

  const canInviteMembers = useCallback(() => {
    return userRole === 'owner' || userRole === 'admin';
  }, [userRole]);

  const canManageMembers = useCallback(() => {
    return userRole === 'owner' || userRole === 'admin';
  }, [userRole]);

  const createOrganization = useCallback(async (name: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const orgId = `org_${Date.now()}_${user.key.substring(0, 8)}`;

      const organizationData: OrganizationData = {
        name,
        ownerId: user.key,
        memberIds: [user.key],
        seatsUsed: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Create organization
      await setDoc({
        collection: 'organizations',
        doc: {
          key: orgId,
          data: organizationData,
        },
      });

      // Create owner membership
      const memberData: OrganizationMemberData = {
        userId: user.key,
        organizationId: orgId,
        role: 'owner',
        joinedAt: Date.now(),
        invitedBy: user.key,
      };

      await setDoc({
        collection: 'organization_members',
        doc: {
          key: `${orgId}_${user.key}`,
          data: memberData,
        },
      });

      // Log activity
      await logActivity({
        action: 'created',
        resource_type: 'export',
        resource_id: orgId,
        resource_name: name,
        created_by: user.key,
        modified_by: user.key,
        success: true,
      });

      showSuccessToast(`Organization "${name}" created successfully`);

      // Reload organization data
      window.location.reload();
    } catch (error) {
      console.error('Failed to create organization:', error);
      showErrorToast('Failed to create organization');
      throw error;
    }
  }, [user]);

  const inviteByEmail = useCallback(async (email: string, role: OrganizationRole) => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');
    if (!canInviteMembers()) throw new Error('No permission to invite members');

    // Check seat availability
    if (availableSeats <= 0) {
      showErrorToast('No available seats. Please upgrade your plan.');
      return;
    }

    try {
      const invitationId = `inv_${Date.now()}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const invitationData: InvitationData = {
        organizationId: currentOrganization.key,
        email,
        role,
        status: 'pending',
        invitedBy: user.key,
        createdAt: Date.now(),
        expiresAt,
      };

      await setDoc({
        collection: 'organization_invitations',
        doc: {
          key: invitationId,
          data: invitationData,
        },
      });

      // Send invitation email (stub for future email service)
      await sendInvitationEmail(
        email,
        currentOrganization.data.name,
        role,
        profile?.data.displayName || profile?.data.email || 'Team member'
      );

      setPendingInvitations((prev) => [
        ...prev,
        { key: invitationId, data: invitationData } as Doc<InvitationData>,
      ]);

      showSuccessToast(`Invitation sent to ${email}`);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      showErrorToast('Failed to send invitation');
      throw error;
    }
  }, [user, currentOrganization, canInviteMembers, availableSeats]);

  const inviteByPrincipal = useCallback(async (principalId: string, role: OrganizationRole) => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');
    if (!canInviteMembers()) throw new Error('No permission to invite members');

    // Check seat availability
    if (availableSeats <= 0) {
      showErrorToast('No available seats. Please upgrade your plan.');
      return;
    }

    try {
      const invitationId = `inv_${Date.now()}_${principalId.substring(0, 8)}`;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const invitationData: InvitationData = {
        organizationId: currentOrganization.key,
        principalId,
        role,
        status: 'pending',
        invitedBy: user.key,
        createdAt: Date.now(),
        expiresAt,
      };

      await setDoc({
        collection: 'organization_invitations',
        doc: {
          key: invitationId,
          data: invitationData,
        },
      });

      setPendingInvitations((prev) => [
        ...prev,
        { key: invitationId, data: invitationData } as Doc<InvitationData>,
      ]);

      showSuccessToast('Invitation sent');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      showErrorToast('Failed to send invitation');
      throw error;
    }
  }, [user, currentOrganization, canInviteMembers, availableSeats]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const invitationDoc = await getDoc({
        collection: 'organization_invitations',
        key: invitationId,
      });

      if (!invitationDoc) throw new Error('Invitation not found');

      const invitation = invitationDoc.data as InvitationData;

      // Check if invitation is expired
      if (invitation.expiresAt < Date.now()) {
        showErrorToast('Invitation has expired');
        return;
      }

      // Create membership
      const memberData: OrganizationMemberData = {
        userId: user.key,
        organizationId: invitation.organizationId,
        role: invitation.role,
        joinedAt: Date.now(),
        invitedBy: invitation.invitedBy,
      };

      await setDoc({
        collection: 'organization_members',
        doc: {
          key: `${invitation.organizationId}_${user.key}`,
          data: memberData,
        },
      });

      // Update invitation status
      await setDoc({
        collection: 'organization_invitations',
        doc: {
          ...invitationDoc,
          data: {
            ...invitation,
            status: 'accepted' as InvitationStatus,
            acceptedAt: Date.now(),
          },
        },
      });

      // Update organization member count
      const orgDoc = await getDoc({
        collection: 'organizations',
        key: invitation.organizationId,
      });

      if (orgDoc) {
        const orgData = orgDoc.data as OrganizationData;
        await setDoc({
          collection: 'organizations',
          doc: {
            ...orgDoc,
            data: {
              ...orgData,
              memberIds: [...orgData.memberIds, user.key],
              seatsUsed: orgData.seatsUsed + 1,
              updatedAt: Date.now(),
            },
          },
        });
      }

      // Cancel user's individual subscription at period end (if they have one)
      try {
        const userSubscription = await getDoc({
          collection: 'subscriptions',
          key: user.key,
        });

        if (userSubscription) {
          const subData = userSubscription.data as any;
          // Only cancel if it's an individual subscription (not organization)
          if (subData.type === 'individual' && subData.planId !== 'free') {
            await setDoc({
              collection: 'subscriptions',
              doc: {
                ...userSubscription,
                data: {
                  ...subData,
                  cancelAtPeriodEnd: true,
                  updatedAt: Date.now(),
                },
                updated_at: BigInt(Date.now()),
              },
            });
          }
        }
      } catch (error) {
        console.error('Failed to cancel individual subscription:', error);
        // Don't throw - invitation was still accepted successfully
      }

      showSuccessToast('Invitation accepted');

      // Reload page to update organization context
      window.location.reload();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      showErrorToast('Failed to accept invitation');
      throw error;
    }
  }, [user]);

  const rejectInvitation = useCallback(async (invitationId: string) => {
    try {
      const invitationDoc = await getDoc({
        collection: 'organization_invitations',
        key: invitationId,
      });

      if (!invitationDoc) return;

      const invitation = invitationDoc.data as InvitationData;

      await setDoc({
        collection: 'organization_invitations',
        doc: {
          ...invitationDoc,
          data: {
            ...invitation,
            status: 'rejected' as InvitationStatus,
          },
        },
      });

      showSuccessToast('Invitation rejected');
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      showErrorToast('Failed to reject invitation');
    }
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');
    if (!canManageMembers()) throw new Error('No permission to remove members');

    try {
      // Cannot remove the owner
      const memberToRemove = members.find((m) => m.key === memberId);
      if (!memberToRemove) return;

      const memberData = memberToRemove.data as OrganizationMemberData;
      if (memberData.role === 'owner') {
        showErrorToast('Cannot remove organization owner');
        return;
      }

      // Delete membership
      await deleteDoc({
        collection: 'organization_members',
        doc: memberToRemove,
      });

      // Update organization
      const orgData = currentOrganization.data as OrganizationData;
      await setDoc({
        collection: 'organizations',
        doc: {
          ...currentOrganization,
          data: {
            ...orgData,
            memberIds: orgData.memberIds.filter((id) => id !== memberData.userId),
            seatsUsed: Math.max(0, orgData.seatsUsed - 1),
            updatedAt: Date.now(),
          },
        },
      });

      setMembers((prev) => prev.filter((m) => m.key !== memberId));
      showSuccessToast('Member removed');
    } catch (error) {
      console.error('Failed to remove member:', error);
      showErrorToast('Failed to remove member');
      throw error;
    }
  }, [user, currentOrganization, members, canManageMembers]);

  const updateMemberRole = useCallback(async (memberId: string, newRole: OrganizationRole) => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');
    if (userRole !== 'owner') throw new Error('Only owner can change roles');

    try {
      const memberDoc = members.find((m) => m.key === memberId);
      if (!memberDoc) return;

      const memberData = memberDoc.data as OrganizationMemberData;

      await setDoc({
        collection: 'organization_members',
        doc: {
          ...memberDoc,
          data: {
            ...memberData,
            role: newRole,
          },
        },
      });

      setMembers((prev) =>
        prev.map((m) =>
          m.key === memberId
            ? { ...m, data: { ...m.data, role: newRole } as OrganizationMemberData }
            : m
        )
      );

      showSuccessToast('Member role updated');
    } catch (error) {
      console.error('Failed to update member role:', error);
      showErrorToast('Failed to update member role');
      throw error;
    }
  }, [user, currentOrganization, userRole, members]);

  const leaveOrganization = useCallback(async () => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');
    if (userRole === 'owner') {
      showErrorToast('Owner cannot leave organization. Please transfer ownership first.');
      return;
    }

    try {
      const memberKey = `${currentOrganization.key}_${user.key}`;
      const memberDoc = members.find((m) => m.key === memberKey);
      
      if (memberDoc) {
        await deleteDoc({
          collection: 'organization_members',
          doc: memberDoc,
        });
      }

      // Update organization
      const orgData = currentOrganization.data as OrganizationData;
      await setDoc({
        collection: 'organizations',
        doc: {
          ...currentOrganization,
          data: {
            ...orgData,
            memberIds: orgData.memberIds.filter((id) => id !== user.key),
            seatsUsed: Math.max(0, orgData.seatsUsed - 1),
            updatedAt: Date.now(),
          },
        },
      });

      showSuccessToast('Left organization');
      window.location.reload();
    } catch (error) {
      console.error('Failed to leave organization:', error);
      showErrorToast('Failed to leave organization');
      throw error;
    }
  }, [user, currentOrganization, userRole, members]);

  const exportOrganizationData = useCallback(async () => {
    if (!user || !currentOrganization) throw new Error('Not in an organization');

    try {
      // Get all templates owned by organization members
      const templates = await listDocs({
        collection: 'templates_meta',
      });

      const memberIds = (currentOrganization.data as OrganizationData).memberIds;
      const orgTemplates = templates.items.filter(doc => 
        memberIds.includes(doc.owner ?? '')
      );

      // Create export data
      const exportData = {
        organization: {
          name: (currentOrganization.data as OrganizationData).name,
          createdAt: (currentOrganization.data as OrganizationData).createdAt,
          members: members.map(m => ({
            role: (m.data as OrganizationMemberData).role,
            joinedAt: (m.data as OrganizationMemberData).joinedAt,
          })),
        },
        templates: orgTemplates.map(t => ({
          key: t.key,
          name: (t.data as any).name,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        })),
        exportedAt: Date.now(),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(currentOrganization.data as OrganizationData).name.replace(/\s+/g, '_')}_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccessToast('Organization data exported successfully');
    } catch (error) {
      console.error('Failed to export organization data:', error);
      showErrorToast('Failed to export organization data');
      throw error;
    }
  }, [user, currentOrganization, members]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        userRole,
        members,
        pendingInvitations,
        userInvitations,
        isLoading,
        createOrganization,
        inviteByEmail,
        inviteByPrincipal,
        acceptInvitation,
        rejectInvitation,
        removeMember,
        updateMemberRole,
        leaveOrganization,
        canInviteMembers,
        canManageMembers,
        availableSeats,
        exportOrganizationData,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
