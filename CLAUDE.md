# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rexfill is a Word template processing application built on Juno (Internet Computer blockchain). It allows users to upload DOCX templates with placeholders (e.g., `{{name}}`), organize them in folders, and dynamically fill them with data. Templates can be saved permanently or processed one-time without saving.

## Development Commands

```bash
# Install dependencies
npm install

# Start frontend dev server (port 5173)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Preview production build
npm run preview

# Start local Juno emulator (required for backend)
juno emulator start

# Deploy to production satellite
juno hosting deploy
```

## Architecture

### Juno Backend Integration

The app uses Juno (Internet Computer) for decentralized storage and authentication:

- **Authentication**: Internet Identity for user auth (initialized in [App.tsx](src/App.tsx))
- **Collections** (defined in [juno.config.ts](juno.config.ts)):
  - **Storage Collections**:
    - `templates`: Stores actual DOCX files
    - `user_avatars`: User profile images
  - **Datastore Collections**:
    - `templates_meta`: Template metadata (name, size, folderId, paths, custom property counts)
    - `folders`: Folder hierarchy for organizing templates
    - `subscriptions`: User subscription plans and status
    - `usage`: Document processing and template usage tracking
    - `contact_submissions`: Public contact form submissions
    - `activity_logs`: Audit logs for all template/folder operations
    - `user_profiles`: User display name, email, bio, preferences
- **Satellite IDs**: Development (`auamu-4x777-77775-aaaaa-cai`) and production (`ufqml-byaaa-aaaas-amtia-cai`) satellites
- **Orbiter IDs**: Development (`atbka-rp777-77775-aaaaq-cai`) for analytics integration

### State Management

Context-based architecture with multiple specialized providers:

1. **AuthContext** ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)): Internet Identity authentication with activity logging
2. **ThemeContext** ([src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx)): Light/dark mode toggle
3. **ConfirmProvider** ([src/contexts/ConfirmContext.tsx](src/contexts/ConfirmContext.tsx)): Confirmation dialogs with custom UI
4. **ProcessorContext** ([src/contexts/ProcessorContext.tsx](src/contexts/ProcessorContext.tsx)): Document processing state management
5. **FileProcessingContext** ([src/contexts/FileProcessingContext.tsx](src/contexts/FileProcessingContext.tsx)): Single/multi-file processing orchestration
6. **SearchContext** ([src/contexts/SearchContext.tsx](src/contexts/SearchContext.tsx)): Global search state for templates and folders
7. **SubscriptionContext** ([src/contexts/SubscriptionContext.tsx](src/contexts/SubscriptionContext.tsx)): Plan limits, usage tracking, and billing
8. **UserProfileContext** ([src/contexts/UserProfileContext.tsx](src/contexts/UserProfileContext.tsx)): User profile and avatar management

### Folder System

2-level hierarchical folder structure for organizing templates:

- **Types**: `Folder` and `FolderData` defined in [**custom properties** (NOT placeholders):

1. **Custom Properties**: Reads/writes Word custom document properties from `docProps/custom.xml` via [src/utils/customProperties.ts](src/utils/customProperties.ts)
2. **Field Updates**: Updates Word document fields (including headers/footers) to reflect custom property values using optimized single-pass regex in [src/utils/documentProcessing.ts](src/utils/documentProcessing.ts)
3. **Web Worker Processing**: Heavy document operations run in a dedicated Web Worker ([src/workers/documentProcessor.worker.ts](src/workers/documentProcessor.worker.ts)) with progress tracking
4. **Processing Modes**:
   - **Save Only**: Upload template without processing
   - **Save & Process**: Upload and immediately process
   - **One-time Process**: Process file without saving to database (with file hash logging)
   - **Multi-file Batch**: Process multiple templates/files simultaneously with shared and unique fields
5. **Metadata Extraction**: Automatically extracts custom property count when uploading templates via [src/utils/extractMetadata.ts](src/utils/extractMetadata.ts)
6. **Performance Optimization**: Incremental change tracking, batched state updates, and optimized field replacement patterns

1. **Extraction**: Uses `docxtemplater` and `pizzip` to parse DOCX files
2. **Placeholders**: Extracts `{{placeholder}}` patterns from document.xml by reconstructing text from XML runs
3. **Custom Properties**: Reads/writes Word custom document properties (fields) via [src/utils/customProperties.ts](src/utils/customProperties.ts)
4. **Processing Modes**:
   - **Save Only**: Upload template without processing
   - **Save & Process**: Upload and immediately process
   - **One-time Process**: Process file without saving to database
5. **Field Updates**: Updates both placeholders AND Word document fields (for auto-updating fields in Word)

### Internationalization

Multi-language support via react-i18next:

- **Supported Languages**: English, Slovak (default), Czech, Polish, Hungarian, German, Spanish, Italian, French, Chinese, Japanese
- **Auto-detection**: Uses browser/OS language with fallback to Slovak
- **Translation Files**: JSON files in [src/locales/](src/locales/)
- **Usage Pattern**: `const { t } = useTranslation(); t('key.path')`
- **Subscription & Billing

Multi-tier subscription system with usage tracking:

- **Plans**: Free, Starter, Professional, Enterprise defined in [src/config/plans.ts](src/config/plans.ts)
- **Limits**: Documents per day/month, max templates, file size, batch processing
- **Usage Tracking**: Real-time tracking of documents processed today/this month and total templates
- **Components**: Usage meters, subscription badges, upgrade prompts in [src/components/billing/](src/components/billing/)
- **Future Integration**: Paddle payment gateway configuration in juno.config.ts (not yet implemented)

### Activity Logging & Audit Trail

Comprehensive logging system for all user actions:

- **Logged Actions**: Created, updated, deleted, renamed, moved, downloaded, processed_onetime, login, logout, exported, imported
- **Resource Types**: Template, folder, onetime_file, auth_event, user_profile, export, import, subscription
- **Data Captured**: Timestamp, user principals (created_by, modified_by), resource details, success status, old/new values, file metadata
- **One-time Processing**: Includes SHA-256 file hash and field names for audit purposes
- **Implementation**: [src/utils/activityLogger.ts](src/utils/activityLogger.ts) with silent failure to not disrupt user operations

### User Profiles

User customization and preferences:

- **Profile Data**: Display name, email, bio, avatar URL
- **Preferences**: Default folder, language, theme (light/dark/system)
**Single File Processing:**
1. Fetch DOCX from Juno Storage or read from File
2. Extract custom properties from `docProps/custom.xml` (via Web Worker if available)
3. Present form with custom property fields
4. On submit:
   - Update custom properties XML
   - Update document fields (including headers/footers) using optimized single-pass regex
   - Process in Web Worker with progress reporting
   - Download processed document
   - Log activity (including file hash for one-time processing)

**Multi-file Batch Processing:**
1. Load multiple templates/files simultaneously
2. Extract custom properties from all files
3. Categorize fields as "shared" (in 2+ files) or "unique" (per file)
4. Present unified form with shared fields at top, unique fields grouped by file
5. On submit:
   - Process all documents in parallel
   - Generate ZIP archive if multiple files
   - Track per-file status and error reporting
   - Save to templates or download based on mode
- **Purpose**: Provides AI assistants with structured information about Juno's serverless functions, satellite deployment, and SDK integration
- *Key Custom Hooks

- **useWordTemplateProcessor** ([src/hooks/useWordTemplateProcessor.ts](src/hooks/useWordTemplateProcessor.ts)): Single-file processing with form state, validation, and saving
- **useMultiFileProcessor** ([src/hooks/useMultiFileProcessor.ts](src/hooks/useMultiFileProcessor.ts)): Batch processing with field categorization and parallel execution
- **useDocumentWorker** ([src/hooks/useDocumentWorker.ts](src/hooks/useDocumentWorker.ts)): Web Worker interface for document operations with promise-based API
- **useFolders** ([src/hooks/useFolders.ts](src/hooks/useFolders.ts)): Folder CRUD operations and tree building
- **useTemplatesQuery** ([src/hooks/useTemplatesQuery.ts](src/hooks/useTemplatesQuery.ts)): React Query integration for template fetching
- **useFoldersQuery** ([src/hooks/useFoldersQuery.ts](src/hooks/useFoldersQuery.ts)): React Query integration for folder fetching
- **useDraftRecovery** ([src/hooks/useDraftRecovery.ts](src/hooks/useDraftRecovery.ts)): Auto-save and restore form data
- **useRecentTemplates** ([src/hooks/useRecentTemplates.ts](src/hooks/useRecentTemplates.ts)): Track recently accessed templates
- **useKeyboardShortcuts** ([src/hooks/useKeyboardShortcuts.ts](src/hooks/useKeyboardShortcuts.ts)): Global keyboard navigation

## Common Pitfalls

### Word Document Processing

- **Custom Properties Only**: The app NO LONGER uses `{{placeholder}}` patterns. All data comes from Word custom properties in `docProps/custom.xml`.
- **Field Updates**: After updating custom properties, MUST call `updateDocumentFields` or `updateDocumentFieldsOptimized` to ensure Word fields display updated values throughout document, headers, and footers.
- **Web Worker**: Heavy operations should use the Web Worker to avoid blocking the UI. Check `isWorkerReady` before using worker method
## Key Data Flows

### File Upload Flow

1. User selects file(s) and upload mode (Save Only / Save & Process / One-time)
2. For saved templates:
   - Build `fullPath` using folder structure
   - Upload to `templates` Storage collection with `fullPath` as filename
   - Save metadata to `templates_meta` Datastore
3. For one-time processing:
   - Pass file directly to `WordTemplateProcessor` without saving

### Template Processing Flow

1. Fetch DOCX from Juno Storage or read from File
2. Extract placeholders from reconstructed XML text (handles Word's split runs)
3. Read existing custom properties from docProps/custom.xml
4. Present form with both placeholder fields and custom property fields
5. On submit:
   - Replace placeholders using docxtemplater
   - Update custom properties XML
   - Update document fields to sync with custom properties
   - Download processed document

### Folder Rename Flow

When renaming a folder, all template paths must be updated:

1. Rename folder document in Datastore
2. Fetch all templates where `folderId` matches
3. For each template, update `folderPath` and `fullPath` using `updateTemplatePathAfterRename`
4. Save updated template metadata
5. Refresh template list

### Activity Logging

- **Silent Failures**: Activity logging is wrapped in try-
  - `app/`: Dashboard, Header, Sidebar, Breadcrumbs
  - `auth/`: Login screen and dialogs
  - `billing/`: Subscription badges, usage meters, upgrade prompts
  - `dialogs/`: Confirm, rename, create folder, drop mode
  - `files/`: Template file management components
  - `folders/`: Folder tree and management
  - `processor/`: Document processing forms and UI
  - `profile/`: User profile and settings
  - `ui/`: Reusable UI primitives (buttons, inputs, etc.)
- `src/contexts/`: React context providers (8 total - see State Management)
- `src/hooks/`: Custom hooks (12 total - see Key Custom Hooks)
- `src/types/`: TypeScript type definitions
  - `activity-log.ts`, `folder.ts`, `multi-processing.ts`, `subscription.ts`, `user-profile.ts`, `word-template.ts`
- `src/utils/`: Utility functions
  - `customProperties.ts`: Read/write Word custom properties
  - `documentProcessing.ts`: Optimized field update logic
  - `activityLogger.ts`: Audit logging with SHA-256 hashing
  - `extractMetadata.ts`: Extract custom property counts
  - `templatePathUtils.ts`: Path construction and updates
  - `junoWithTimeout.ts`: Juno API wrappers with timeout handling
  - `fetchWithTimeout.ts`: Fetch with abort controller
  - `toast.ts`: Success/error notifications
- `src/workers/`: Web Workers for heavy operations
  - `documentProcessor.worker.ts`: Document processing in background thread
  - `types.ts`: Worker message types
- `src/locales/`: i18n translation JSON files (12 languages)
- `src/pages/`: Page components (app pages, public landing pages)
- `src/lib/`: Third-party integrations (paddle.ts for payments)
- **Batched Updates**: Use `pendingChangesRef` and `flushTimeoutRef` patterns for form state
- **Incremental Changes**: Track only changed fields in `changedFieldsRef` to minimize updates
- **Worker vs Sync**: Prefer Web Worker for document operations, but have synchronous fallback
- **Query Caching**: React Query handles template/folder caching automatically

## Common Pitfalls

### Word Document Processing

- **Split Runs**: Word often splits `{{placeholder}}` across multiple `<w:t>` runs. Always reconstruct full text before regex matching.
- **Custom Properties**: Custom properties are stored in `docProps/custom.xml`, not in the main document.xml. Use the utilities in customProperties.ts.
- **Field Updates**: After updating custom properties, must also call `updateDocumentFields` to ensure Word fields display updated values.

### Juno Storage Paths

- **Leading Slashes**: Storage `fullPath` should NOT have leading slash when passed to Juno APIs (`uploadFile`, `deleteAsset`)
- **Display Paths**: UI should show paths with leading slash for clarity
- **Path Construction**: Use `buildTemplatePath` utility to ensure consistent path format

### Translation Keys

- **Missing Translations**: When adding new UI text, add keys to ALL language JSON files (en-US, sk, cs, pl, hu, de, es, it, fr, zh, ja)
- **Hardcoded Text**: Never use hardcoded English strings. Common issue: pagination buttons, search placeholders, etc.

### Folder Depth

- **2-Level Limit**: Folders are limited to 2 levels (root and one level of subfolders)
- **Validation**: Check `folder.data.level` before allowing subfolder creation

## File Organization

- `src/components/`: React components organized by feature (files/, folders/, auth/, ui/)
- `src/contexts/`: React context providers
- `src/hooks/`: Custom hooks (useFolders, useTemplatesByFolder)
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions (paths, custom properties, toast notifications)
- `src/locales/`: i18n translation JSON files
