import { BaseRepository } from '../core/BaseRepository';

export type ContactStatus = 'new' | 'read' | 'replied';

export interface ContactSubmissionData {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: number;
  status: ContactStatus;
  reply?: string;
  repliedAt?: number;
  repliedBy?: string;
}

/**
 * Repository for managing contact form submissions
 */
export class ContactSubmissionRepository extends BaseRepository<ContactSubmissionData> {
  constructor() {
    super('contact_submissions');
  }

  /**
   * Create a new contact submission
   */
  async createSubmission(data: Omit<ContactSubmissionData, 'submittedAt' | 'status'>): Promise<{ key: string; data: ContactSubmissionData }> {
    const key = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const submission: ContactSubmissionData = {
      ...data,
      submittedAt: Date.now(),
      status: 'new',
    };
    
    await this.create(key, submission);
    return { key, data: submission };
  }

  /**
   * List all submissions sorted by submission date (newest first)
   */
  async listAllSorted(): Promise<Array<{ key: string; data: ContactSubmissionData; created_at?: bigint; updated_at?: bigint }>> {
    const docs = await this.list();
    return docs.sort((a, b) => b.data.submittedAt - a.data.submittedAt);
  }

  /**
   * Mark submission as read
   */
  async markAsRead(key: string): Promise<void> {
    const doc = await this.get(key);
    if (doc) {
      await this.update(key, {
        ...doc.data,
        status: 'read',
      });
    }
  }

  /**
   * Add reply to submission
   */
  async addReply(key: string, reply: string, repliedBy: string): Promise<void> {
    const doc = await this.get(key);
    if (doc) {
      await this.update(key, {
        ...doc.data,
        status: 'replied',
        reply,
        repliedAt: Date.now(),
        repliedBy,
      });
    }
  }

  /**
   * Get submissions by status
   */
  async getByStatus(status: ContactStatus): Promise<Array<{ key: string; data: ContactSubmissionData; created_at?: bigint; updated_at?: bigint }>> {
    const allDocs = await this.listAllSorted();
    return allDocs.filter(doc => doc.data.status === status);
  }

  /**
   * Get new (unread) submissions
   */
  async getNew(): Promise<Array<{ key: string; data: ContactSubmissionData; created_at?: bigint; updated_at?: bigint }>> {
    return this.getByStatus('new');
  }
}
