// Notification types for the notification system

export type NotificationType = 
  | 'invitation'
  | 'org_cancelled'
  | 'member_removed'
  | 'grace_period_started'
  | 'grace_period_cancelled'
  | 'subscription_changed'
  | 'subscription_cancelled'
  | 'general';

export interface NotificationData {
  id: string;
  userId: string; // Principal ID of the recipient
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  readAt?: number;
  metadata?: {
    organizationId?: string;
    organizationName?: string;
    invitationId?: string;
    subscriptionId?: string;
    gracePeriodEndsAt?: number;
    [key: string]: any;
  };
}

export interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  createNotification: (notification: Omit<NotificationData, 'id' | 'userId' | 'read' | 'createdAt'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}
