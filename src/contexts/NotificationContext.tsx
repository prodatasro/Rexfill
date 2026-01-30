import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { NotificationData, NotificationContextType } from '../types/notification';
import type { Doc } from '@junobuild/core';
import { notificationRepository } from '../dal';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [notificationDocs, setNotificationDocs] = useState<Doc<NotificationData>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Load notifications for the current user
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const notificationDocs = await notificationRepository.getByUser(user.key);

      const userNotifications = notificationDocs.map((doc: Doc<NotificationData>) => ({
        id: doc.key,
        ...(doc.data as Omit<NotificationData, 'id'>),
      })) as NotificationData[];

      // Sort by creation date (newest first)
      userNotifications.sort((a, b) => b.createdAt - a.createdAt);

      setNotifications(userNotifications);
      setNotificationDocs(notificationDocs);

      // Clean up old read notifications (older than 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const oldReadDocs = notificationDocs.filter((doc: Doc<NotificationData>) => {
        const data = doc.data as NotificationData;
        return data.read && data.readAt && data.readAt < thirtyDaysAgo;
      });

      for (const docToDelete of oldReadDocs) {
        try {
          await notificationRepository.delete(docToDelete.key);
        } catch (error) {
          console.error('Failed to delete old notification:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load notifications on user authentication
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const createNotification = useCallback(async (
    notification: Omit<NotificationData, 'id' | 'userId' | 'read' | 'createdAt'>
  ) => {
    if (!user) return;

    try {
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: NotificationData = {
        id: notificationId,
        userId: user.key,
        read: false,
        createdAt: Date.now(),
        ...notification,
      };

      await notificationRepository.create(notificationId, newNotification, user.key);

      setNotifications(prev => [newNotification, ...prev]);
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification || notification.read) return;

      const updatedNotification: NotificationData = {
        ...notification,
        read: true,
        readAt: Date.now(),
      };

      await notificationRepository.update(notificationId, updatedNotification);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? updatedNotification : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [user, notifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      
      for (const notification of unreadNotifications) {
        const updatedNotification: NotificationData = {
          ...notification,
          read: true,
          readAt: Date.now(),
        };

        await notificationRepository.update(notification.id, updatedNotification);
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: n.readAt || Date.now() }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [user, notifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const docToDelete = notificationDocs.find(doc => doc.key === notificationId);
      if (!docToDelete) return;

      await notificationRepository.delete(notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setNotificationDocs(prev => prev.filter(doc => doc.key !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [user, notificationDocs]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        createNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
