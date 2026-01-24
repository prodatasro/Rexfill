/**
 * Organization and team management types
 */

export type OrganizationRole = 'owner' | 'admin' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Organization entity representing a company or team
 */
export interface OrganizationData {
  name: string;
  ownerId: string; // Principal ID of the organization owner
  memberIds: string[]; // Array of Principal IDs of all members
  subscriptionId?: string; // Reference to the organization's subscription
  seatsUsed: number; // Current number of active members
  createdAt: number;
  updatedAt: number;
}

/**
 * Organization member with role and metadata
 */
export interface OrganizationMemberData {
  userId: string; // Principal ID
  organizationId: string;
  role: OrganizationRole;
  joinedAt: number;
  invitedBy: string; // Principal ID of the user who invited this member
}

/**
 * Invitation to join an organization
 * Supports both email-based and Principal ID-based invitations
 */
export interface InvitationData {
  organizationId: string;
  email?: string; // For email-based invitations (Google OAuth users)
  principalId?: string; // For direct Principal ID invitations (ICP Identity users)
  role: OrganizationRole;
  status: InvitationStatus;
  invitedBy: string; // Principal ID of the user who sent the invitation
  createdAt: number;
  expiresAt: number; // Timestamp when invitation expires (default: 7 days)
  acceptedAt?: number;
}

/**
 * Extended organization with full member details
 */
export interface OrganizationWithMembers extends OrganizationData {
  members: OrganizationMemberData[];
  pendingInvitations: InvitationData[];
}
