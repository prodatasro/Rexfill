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
export const templateStorage = new TemplateStorage();
export const avatarStorage = new AvatarStorage();
