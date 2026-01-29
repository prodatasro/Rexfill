# Data Access Layer (DAL)

This directory contains the complete data access layer for the Rexfill application. The DAL abstracts all Juno SDK interactions, making it easy to migrate to a different backend in the future.

## Structure

```
dal/
├── core/                    # Base abstractions
│   ├── BaseRepository.ts   # Generic CRUD operations with timeout protection
│   ├── types.ts            # Shared types (QueryOptions, PaginationResult, etc.)
│   └── errors.ts           # Custom error classes (RepositoryError, TimeoutError, etc.)
│
├── repositories/            # Domain-specific repositories
│   ├── TemplateRepository.ts      # Template metadata operations
│   ├── FolderRepository.ts        # Folder hierarchy management
│   ├── UserProfileRepository.ts   # User profile data
│   ├── SubscriptionRepository.ts  # Subscriptions and usage tracking
│   ├── OrganizationRepository.ts  # Organizations, members, invitations
│   ├── NotificationRepository.ts  # In-app notifications
│   ├── ActivityLogRepository.ts   # Activity logging and auditing
│   └── AdminRepository.ts         # Admin operations and security events
│
├── storage/                 # File storage operations
│   ├── TemplateStorage.ts  # DOCX file uploads/downloads
│   └── AvatarStorage.ts    # User avatar management
│
└── index.ts                 # Public API exports + singleton instances
```

## Usage

### Using Singleton Instances (Recommended)

The easiest way to use the DAL is through the pre-instantiated singleton instances:

```typescript
import { 
  templateRepository, 
  folderRepository,
  templateStorage 
} from '@/dal';

// Create a template
const template = await templateRepository.create(
  'template-key',
  {
    name: 'My Template',
    size: 1024,
    uploadedAt: Date.now(),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    folderId: null
  },
  userPrincipal
);

// Upload template file
await templateStorage.upload('template-key.docx', file);

// List templates for user
const templates = await templateRepository.getByOwner(userPrincipal);
```

### Creating Custom Instances

For testing or special use cases, you can create your own instances:

```typescript
import { TemplateRepository, TemplateStorage } from '@/dal';

const customTemplateRepo = new TemplateRepository();
const customStorage = new TemplateStorage();
```

## Repositories

### TemplateRepository

Manages template metadata in the `templates_meta` collection.

```typescript
// Get templates in a folder
const templates = await templateRepository.getByFolder(folderId, ownerPrincipal);

// Search templates
const results = await templateRepository.search('legal', ownerPrincipal);

// Get favorites
const favorites = await templateRepository.getFavorites(ownerPrincipal);

// Toggle favorite
await templateRepository.toggleFavorite(templateKey);

// Move to folder
await templateRepository.moveToFolder(templateKey, newFolderId);

// Batch operations
await templateRepository.batchMoveToFolder(['key1', 'key2'], folderId);
```

### FolderRepository

Manages folder hierarchy (max 2 levels deep).

```typescript
// Create root folder
const folder = await folderRepository.createFolder(
  'folder-key',
  {
    name: 'My Folder',
    parentId: null,
    path: '/My Folder',
    level: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0
  },
  ownerPrincipal
);

// Get folder hierarchy
const rootFolders = await folderRepository.getRootFolders(ownerPrincipal);
const subfolders = await folderRepository.getSubfolders(parentId, ownerPrincipal);

// Get breadcrumb path
const path = await folderRepository.getFolderPath(folderId);

// Move folder (with validation)
await folderRepository.moveFolder(folderId, newParentId);

// Delete recursively
await folderRepository.deleteRecursive(folderId, ownerPrincipal);
```

### UserProfileRepository

Manages user profile data.

```typescript
// Get or create profile
const profile = await userProfileRepository.upsert(principal, {
  displayName: 'John Doe',
  email: 'john@example.com',
  preferences: {
    language: 'en',
    theme: 'dark'
  }
});

// Update preferences
await userProfileRepository.updatePreferences(principal, {
  theme: 'light'
});

// Update avatar
await userProfileRepository.updateAvatar(principal, avatarUrl);

// Check if admin
const isAdmin = await userProfileRepository.isAdmin(principal);
```

### SubscriptionRepository

Manages subscriptions and usage tracking.

```typescript
// Get subscription
const subscription = await subscriptionRepository.getByPrincipal(principal);

// Update status
await subscriptionRepository.updateStatus(principal, 'active');

// Cancel subscription
await subscriptionRepository.cancel(principal);

// Track usage
await subscriptionRepository.incrementTemplateUsage(principal);
await subscriptionRepository.incrementDocumentUsage(principal);

// Get usage
const usage = await subscriptionRepository.getUsage(principal);
```

### OrganizationRepository

Manages organizations, members, and invitations.

```typescript
// Get user's organizations
const orgs = await organizationRepository.getByMember(principal);

// Manage members
await organizationRepository.addMember(orgId, userId, 'member', invitedBy);
const members = await organizationRepository.getMembers(orgId);
await organizationRepository.updateMemberRole(orgId, userId, 'admin');
await organizationRepository.removeMember(orgId, userId);

// Invitations
const invitation = await organizationRepository.createInvitation(
  orgId, 
  'user@example.com', 
  'member',
  invitedBy
);
await organizationRepository.acceptInvitation(invitationKey, userId);
await organizationRepository.rejectInvitation(invitationKey);
```

### NotificationRepository

Manages in-app notifications.

```typescript
// Create notification
await notificationRepository.createForUser(
  userId,
  notificationKey,
  {
    type: 'invitation',
    title: 'New Invitation',
    message: 'You have been invited to join an organization'
  }
);

// Get unread notifications
const unread = await notificationRepository.getUnread(userId);
const count = await notificationRepository.getUnreadCount(userId);

// Mark as read
await notificationRepository.markAsRead(notificationKey);
await notificationRepository.markAllAsRead(userId);

// Delete
await notificationRepository.deleteNotification(notificationKey);
```

### ActivityLogRepository

Manages activity logs and audit trails.

```typescript
// Log activity
await activityLogRepository.log(
  userId,
  logKey,
  {
    action: 'created',
    resource_type: 'template',
    resource_id: templateKey,
    resource_name: 'My Template',
    created_by: userId,
    modified_by: userId,
    success: true
  }
);

// Query logs
const logs = await activityLogRepository.getByUser(userId, 50);
const templateLogs = await activityLogRepository.getByEntity(userId, 'template');
const recentLogs = await activityLogRepository.getByDateRange(
  userId, 
  startDate, 
  endDate
);
```

### AdminRepository

Manages platform administration.

```typescript
// Admin management
await adminRepository.addAdmin(principal, addedBy);
const isAdmin = await adminRepository.isAdmin(principal);

// Log admin action
await adminRepository.logAction(actionKey, {
  adminId: principal,
  action: 'suspend_user',
  targetType: 'user',
  targetId: userId,
  timestamp: Date.now()
});

// User suspension
await adminRepository.suspendUser(userId, 'Terms violation', adminId);
const suspended = await adminRepository.isSuspended(userId);
await adminRepository.unsuspendUser(userId);

// Security events
await adminRepository.logSecurityEvent(eventKey, {
  userId,
  severity: 'high',
  eventType: 'failed_login',
  description: 'Multiple failed login attempts'
});
```

## Storage Handlers

### TemplateStorage

Handles DOCX file uploads/downloads with retry logic.

```typescript
// Upload (with automatic retry on failure)
await templateStorage.upload('folder/template.docx', file);

// Delete
await templateStorage.delete('folder/template.docx');

// List files
const files = await templateStorage.list({ owner: principal });

// Check existence
const exists = await templateStorage.exists('folder/template.docx', principal);
```

### AvatarStorage

Handles user avatar uploads with validation.

```typescript
// Upload (validates size and type)
await avatarStorage.upload('user-avatar.jpg', file);

// Replace (uploads new, deletes old)
await avatarStorage.replace(oldPath, newPath, file);

// Delete
await avatarStorage.delete('user-avatar.jpg');
```

## Error Handling

The DAL provides custom error classes for better error handling:

```typescript
import { 
  RepositoryError, 
  NotFoundError, 
  TimeoutError, 
  ValidationError,
  VersionConflictError
} from '@/dal';

try {
  await templateRepository.get('non-existent-key');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Template not found');
  } else if (error instanceof TimeoutError) {
    console.log('Operation timed out');
  } else if (error instanceof ValidationError) {
    console.log('Validation failed:', error.field);
  } else if (error instanceof VersionConflictError) {
    console.log('Version conflict - retry needed');
  }
}
```

## Features

### Automatic Timeouts

All repository operations have automatic timeout protection (30s for reads/writes, 120s for uploads):

```typescript
// Automatically wraps operations with timeout
const template = await templateRepository.get(key); // Times out after 30s
```

### Retry Logic

Storage operations include automatic retry with exponential backoff:

```typescript
// Retries up to 3 times with exponential backoff
await templateStorage.upload(path, file);
```

### Batch Operations

Internal batch processing for bulk operations:

```typescript
// Processes in batches of 10 to avoid overwhelming the system
await templateRepository.batchMoveToFolder(['key1', 'key2', ...], folderId);
```

### Version Conflict Handling

Repositories handle version conflicts automatically:

```typescript
// Throws VersionConflictError if version mismatch
await userProfileRepository.update(principal, data, currentVersion);
```

## Migration Readiness

The DAL is designed to make backend migration straightforward:

1. **All Juno SDK calls are isolated** within repositories and storage handlers
2. **Interfaces remain stable** - change implementation, not the API
3. **Type safety** ensures compile-time verification during migration
4. **Error abstraction** hides backend-specific error details

### Migration Strategy

To migrate to a new backend:

1. Keep the repository interfaces (IRepository, IStorage)
2. Implement new concrete classes for the new backend
3. Update singleton instances in `index.ts`
4. No changes needed in application code

Example:

```typescript
// Before (Juno)
class TemplateRepository extends BaseRepository<TemplateData> {
  // Uses Juno SDK internally
}

// After (New Backend)
class TemplateRepository implements IRepository<TemplateData> {
  // Uses new backend SDK internally
  // Same public API!
}
```

## Best Practices

1. **Use singleton instances** for normal application code
2. **Handle errors** using custom error classes
3. **Pass owner principal** for proper access control
4. **Use batch operations** when processing multiple items
5. **Leverage query options** for filtering and pagination
6. **Version-aware updates** to prevent conflicts

## Notes

- **Authentication is handled separately** - not part of the DAL
- **Satellite functions are not migrated** - they run in a different context
- **Collections use mandatory pagination** for unbounded growth protection
- **Batch operations process internally** using `setMany` with chunking
