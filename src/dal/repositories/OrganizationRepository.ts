import { BaseRepository } from '../core/BaseRepository';
import type { 
  OrganizationData, 
  OrganizationMemberData, 
  InvitationData 
} from '../../types/organization';
import type { Doc } from '@junobuild/core';
import { nanoid } from 'nanoid';

// Helper repository classes
class OrganizationMemberRepository extends BaseRepository<OrganizationMemberData> {
  constructor() {
    super('organization_members');
  }
}

class OrganizationInvitationRepository extends BaseRepository<InvitationData> {
  constructor() {
    super('organization_invitations');
  }
}

export class OrganizationRepository extends BaseRepository<OrganizationData> {
  private memberRepository: OrganizationMemberRepository;
  private invitationRepository: OrganizationInvitationRepository;

  constructor() {
    super('organizations');
    this.memberRepository = new OrganizationMemberRepository();
    this.invitationRepository = new OrganizationInvitationRepository();
  }

  /**
   * Get organizations where user is a member
   */
  async getByMember(principal: string): Promise<Array<Doc<OrganizationData>>> {
    const members = await this.memberRepository.list();
    const userMemberships = members.filter(m => m.data.userId === principal);
    
    const orgs = await Promise.all(
      userMemberships.map(m => this.get(m.data.organizationId))
    );
    
    return orgs.filter((org): org is Doc<OrganizationData> => org !== undefined);
  }

  /**
   * Get organization by owner
   */
  async getByOwner(ownerId: string): Promise<Array<Doc<OrganizationData>>> {
    const orgs = await this.list();
    return orgs.filter(org => org.data.ownerId === ownerId);
  }

  /**
   * Check if user is member of organization
   */
  async isMember(orgId: string, principal: string): Promise<boolean> {
    const members = await this.getMembers(orgId);
    return members.some(m => m.data.userId === principal);
  }

  /**
   * Check if user is owner of organization
   */
  async isOwner(orgId: string, principal: string): Promise<boolean> {
    const org = await this.get(orgId);
    return org?.data.ownerId === principal;
  }

  /**
   * Get organization members
   */
  async getMembers(orgId: string): Promise<Array<Doc<OrganizationMemberData>>> {
    const members = await this.memberRepository.list();
    return members.filter(m => m.data.organizationId === orgId);
  }

  /**
   * Get all members across all organizations (for admin)
   */
  async getAllMembers(): Promise<Array<Doc<OrganizationMemberData>>> {
    return await this.memberRepository.list();
  }

  /**
   * Get member by user ID
   */
  async getMember(orgId: string, userId: string): Promise<Doc<OrganizationMemberData> | undefined> {
    const members = await this.getMembers(orgId);
    return members.find(m => m.data.userId === userId);
  }

  /**
   * Add member to organization
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrganizationMemberData['role'],
    invitedBy: string
  ): Promise<Doc<OrganizationMemberData>> {
    const key = `${orgId}_${userId}`;
    const member: OrganizationMemberData = {
      organizationId: orgId,
      userId,
      role,
      joinedAt: Date.now(),
      invitedBy
    };

    return this.memberRepository.create(key, member, userId);
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    role: OrganizationMemberData['role']
  ): Promise<Doc<OrganizationMemberData>> {
    const member = await this.getMember(orgId, userId);
    if (!member) {
      throw new Error('Member not found');
    }

    return this.memberRepository.update(member.key, {
      ...member.data,
      role
    }, member.version);
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    const key = `${orgId}_${userId}`;
    await this.memberRepository.delete(key);
  }

  /**
   * Get pending invitations for organization
   */
  async getInvitations(orgId: string): Promise<Array<Doc<InvitationData>>> {
    const invitations = await this.invitationRepository.list();
    return invitations.filter(
      inv => inv.data.organizationId === orgId && inv.data.status === 'pending'
    );
  }

  /**
   * Create invitation
   */
  async createInvitation(
    orgId: string,
    email: string,
    role: OrganizationMemberData['role'],
    invitedBy: string
  ): Promise<Doc<InvitationData>> {
    const key = nanoid();
    const invitation: InvitationData = {
      organizationId: orgId,
      email,
      role,
      status: 'pending',
      invitedBy,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    return this.invitationRepository.create(key, invitation, invitedBy);
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(invitationKey: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.getOrThrow(invitationKey);
    
    if (invitation.data.status !== 'pending') {
      throw new Error('Invitation is not pending');
    }

    if (Date.now() > invitation.data.expiresAt) {
      throw new Error('Invitation has expired');
    }

    // Add user as member
    await this.addMember(
      invitation.data.organizationId,
      userId,
      invitation.data.role,
      invitation.data.invitedBy
    );

    // Update invitation status
    await this.invitationRepository.update(invitationKey, {
      ...invitation.data,
      status: 'accepted',
      acceptedAt: Date.now()
    }, invitation.version);
  }

  /**
   * Reject invitation
   */
  async rejectInvitation(invitationKey: string): Promise<void> {
    const invitation = await this.invitationRepository.getOrThrow(invitationKey);
    
    await this.invitationRepository.update(invitationKey, {
      ...invitation.data,
      status: 'rejected'
    }, invitation.version);
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationKey: string): Promise<void> {
    await this.invitationRepository.delete(invitationKey);
  }

  /**
   * Update organization settings
   */
  async updateOrganization(
    orgId: string,
    updates: Partial<OrganizationData>
  ): Promise<Doc<OrganizationData>> {
    const org = await this.getOrThrow(orgId);
    return this.update(orgId, {
      ...org.data,
      ...updates,
      updatedAt: Date.now()
    }, org.version);
  }
}
