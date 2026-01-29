import { BaseRepository } from '../core/BaseRepository';
import type { NotificationData } from '../../types/notification';
import type { Doc } from '@junobuild/core';

export class NotificationRepository extends BaseRepository<NotificationData> {
  constructor() {
    super('notifications');
  }

  /**
   * Get notifications for a user
   */
  async getByUser(userId: string): Promise<Array<Doc<NotificationData>>> {
    return this.list({ owner: userId });
  }

  /**
   * Get unread notifications for a user
   */
  async getUnread(userId: string): Promise<Array<Doc<NotificationData>>> {
    const notifications = await this.getByUser(userId);
    return notifications.filter(n => !n.data.read);
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const unread = await this.getUnread(userId);
    return unread.length;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(key: string): Promise<Doc<NotificationData>> {
    const notification = await this.getOrThrow(key);
    return this.update(key, {
      ...notification.data,
      read: true,
      readAt: Date.now()
    }, notification.version);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const unread = await this.getUnread(userId);
    
    await Promise.all(
      unread.map(notification => this.markAsRead(notification.key))
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(key: string): Promise<void> {
    await this.delete(key);
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const notifications = await this.getByUser(userId);
    
    await Promise.all(
      notifications.map(n => this.delete(n.key))
    );
  }

  /**
   * Create notification for user
   */
  async createForUser(
    userId: string,
    key: string,
    notification: Omit<NotificationData, 'id' | 'userId' | 'createdAt' | 'read'>
  ): Promise<Doc<NotificationData>> {
    const data: NotificationData = {
      ...notification,
      id: key,
      userId,
      read: false,
      createdAt: Date.now()
    };

    return this.create(key, data, userId);
  }

  /**
   * Create multiple notifications for multiple users
   */
  async createBulk(
    notifications: Array<{
      userId: string;
      key: string;
      data: Omit<NotificationData, 'id' | 'userId' | 'createdAt' | 'read'>;
    }>
  ): Promise<void> {
    const docs = notifications.map(({ userId, key, data }) => ({
      key,
      data: {
        ...data,
        id: key,
        userId,
        read: false,
        createdAt: Date.now()
      } as NotificationData,
      owner: userId
    }));

    await this.setMany(docs);
  }
}
