// Core exports
export * from './core/types';
export * from './core/errors';
export { BaseRepository } from './core/BaseRepository';

// Repository exports
export { TemplateRepository } from './repositories/TemplateRepository';
export { FolderRepository } from './repositories/FolderRepository';
export { UserProfileRepository } from './repositories/UserProfileRepository';
export { SubscriptionRepository } from './repositories/SubscriptionRepository';
export { OrganizationRepository } from './repositories/OrganizationRepository';
export { NotificationRepository } from './repositories/NotificationRepository';
export { ActivityLogRepository } from './repositories/ActivityLogRepository';
export { AdminRepository } from './repositories/AdminRepository';
export { UsageRepository } from './repositories/UsageRepository';
export { AdminNotificationRepository } from './repositories/AdminNotificationRepository';
export { DownloadRequestRepository } from './repositories/DownloadRequestRepository';
export { ContactSubmissionRepository } from './repositories/ContactSubmissionRepository';
export { SecretRepository } from './repositories/SecretRepository';
export { CanisterConfigTriggerRepository } from './repositories/CanisterConfigTriggerRepository';
export { SecurityEventRepository } from './repositories/SecurityEventRepository';
export { AdminActionRepository } from './repositories/AdminActionRepository';
export { SubscriptionOverrideRepository } from './repositories/SubscriptionOverrideRepository';
export { WebhookHistoryRepository } from './repositories/WebhookHistoryRepository';

// Storage exports
export { TemplateStorage } from './storage/TemplateStorage';
export { AvatarStorage } from './storage/AvatarStorage';

// Singleton instances for convenience
import { TemplateRepository } from './repositories/TemplateRepository';
import { FolderRepository } from './repositories/FolderRepository';
import { UserProfileRepository } from './repositories/UserProfileRepository';
import { SubscriptionRepository } from './repositories/SubscriptionRepository';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { NotificationRepository } from './repositories/NotificationRepository';
import { ActivityLogRepository } from './repositories/ActivityLogRepository';
import { AdminRepository } from './repositories/AdminRepository';
import { UsageRepository } from './repositories/UsageRepository';
import { AdminNotificationRepository } from './repositories/AdminNotificationRepository';
import { DownloadRequestRepository } from './repositories/DownloadRequestRepository';
import { ContactSubmissionRepository } from './repositories/ContactSubmissionRepository';
import { SecretRepository } from './repositories/SecretRepository';
import { CanisterConfigTriggerRepository } from './repositories/CanisterConfigTriggerRepository';
import { SecurityEventRepository } from './repositories/SecurityEventRepository';
import { AdminActionRepository } from './repositories/AdminActionRepository';
import { SubscriptionOverrideRepository } from './repositories/SubscriptionOverrideRepository';
import { WebhookHistoryRepository } from './repositories/WebhookHistoryRepository';
import { TemplateStorage } from './storage/TemplateStorage';
import { AvatarStorage } from './storage/AvatarStorage';

export const templateRepository = new TemplateRepository();
export const folderRepository = new FolderRepository();
export const userProfileRepository = new UserProfileRepository();
export const subscriptionRepository = new SubscriptionRepository();
export const organizationRepository = new OrganizationRepository();
export const notificationRepository = new NotificationRepository();
export const activityLogRepository = new ActivityLogRepository();
export const adminRepository = new AdminRepository();
export const usageRepository = new UsageRepository();
export const adminNotificationRepository = new AdminNotificationRepository();
export const downloadRequestRepository = new DownloadRequestRepository();
export const contactSubmissionRepository = new ContactSubmissionRepository();
export const secretRepository = new SecretRepository();
export const canisterConfigTriggerRepository = new CanisterConfigTriggerRepository();
export const securityEventRepository = new SecurityEventRepository();
export const adminActionRepository = new AdminActionRepository();
export const subscriptionOverrideRepository = new SubscriptionOverrideRepository();
export const webhookHistoryRepository = new WebhookHistoryRepository();
export const templateStorage = new TemplateStorage();
export const avatarStorage = new AvatarStorage();
