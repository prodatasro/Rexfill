import { BaseRepository } from '../core/BaseRepository';
import type { Doc } from '@junobuild/core';

export interface AdminNotificationData {
  description: string; // Format: "read:boolean;message:text"
  metadata?: Record<string, any>;
}

export interface ParsedAdminNotification {
  key: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  userId: string;
  metadata?: Record<string, any>;
  timestamp: number;
  read: boolean;
}

export class AdminNotificationRepository extends BaseRepository<AdminNotificationData> {
  constructor() {
    super('admin_notifications');
  }

  /**
   * Create a notification with proper key format
   * Key format: timestamp_severity_userId
   */
  async createNotification(
    userId: string,
    severity: 'critical' | 'warning' | 'info',
    message: string,
    metadata?: Record<string, any>
  ): Promise<Doc<AdminNotificationData>> {
    const timestamp = Date.now();
    const key = `${timestamp}_${severity}_${userId}`;
    const description = `read:false;message:${message}`;

    return this.create(key, {
      description,
      metadata
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notification: ParsedAdminNotification): Promise<Doc<AdminNotificationData>> {
    const description = `read:true;message:${notification.message}`;
    
    const existing = await this.get(notification.key);
    if (!existing) {
      throw new Error(`Notification ${notification.key} not found`);
    }

    return this.update(notification.key, {
      description,
      metadata: notification.metadata
    }, existing.version);
  }

  /**
   * Get all notifications with parsed data
   */
  async getAllParsed(): Promise<ParsedAdminNotification[]> {
    const notifications = await this.list();
    
    return notifications.map(item => this.parseNotification(item))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get notifications filtered by severity
   */
  async getBySeverity(severity: 'critical' | 'warning' | 'info'): Promise<ParsedAdminNotification[]> {
    const allNotifications = await this.getAllParsed();
    return allNotifications.filter(n => n.severity === severity);
  }

  /**
   * Get notifications for a specific user
   */
  async getByUserId(userId: string): Promise<ParsedAdminNotification[]> {
    const allNotifications = await this.getAllParsed();
    return allNotifications.filter(n => n.userId === userId);
  }

  /**
   * Get unread notifications
   */
  async getUnread(): Promise<ParsedAdminNotification[]> {
    const allNotifications = await this.getAllParsed();
    return allNotifications.filter(n => !n.read);
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(): Promise<number> {
    const unread = await this.getUnread();
    return unread.length;
  }

  /**
   * Parse a notification document into a structured format
   */
  private parseNotification(item: Doc<AdminNotificationData>): ParsedAdminNotification {
    const key = item.key;
    const parts = key.split('_');
    const timestamp = parseInt(parts[0]);
    const severity = parts[1] as 'critical' | 'warning' | 'info';
    const userId = parts.slice(2).join('_'); // Handle user IDs that might contain underscores
    
    // Parse description for read status and message
    const description = item.data.description || '';
    const readMatch = description.match(/read:(true|false);/);
    const read = readMatch ? readMatch[1] === 'true' : false;
    const messageMatch = description.match(/message:(.+)/);
    const message = messageMatch ? messageMatch[1] : '';
    
    return {
      key,
      message,
      severity,
      userId,
      metadata: item.data.metadata,
      timestamp,
      read,
    };
  }

  /**
   * Delete old notifications (older than specified days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
    const allNotifications = await this.getAllParsed();
    
    const toDelete = allNotifications.filter(n => n.timestamp < cutoffTimestamp);
    
    for (const notification of toDelete) {
      await this.delete(notification.key);
    }
    
    return toDelete.length;
  }
}
