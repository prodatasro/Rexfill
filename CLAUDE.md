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
  - `templates` (Storage): Stores actual DOCX files
  - `templates_meta` (Datastore): Template metadata (name, size, folderId, paths)
  - `folders` (Datastore): Folder hierarchy for organizing templates
- **Satellite IDs**: Development and production satellites configured in `juno.config.ts`

### State Management

Context-based architecture with three main providers:

1. **AuthContext** ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)): Manages Internet Identity authentication
2. **ThemeContext** ([src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx)): Light/dark mode toggle
3. **ConfirmProvider** ([src/contexts/ConfirmContext.tsx](src/contexts/ConfirmContext.tsx)): Confirmation dialogs with custom UI

### Folder System

2-level hierarchical folder structure for organizing templates:

- **Types**: `Folder` and `FolderData` defined in [src/types/folder.ts](src/types/folder.ts)
- **Tree Structure**: `FolderTreeNode` provides recursive tree with template counts
- **Hooks**: `useFolders` manages CRUD operations and tree building
- **Path Management**:
  - Templates store `folderId` (reference), `folderPath` (denormalized path like `/Legal/Contracts`), and `fullPath` (complete path with filename)
  - Utilities in [src/utils/templatePathUtils.ts](src/utils/templatePathUtils.ts) handle path construction and updates during folder renames

### Document Processing

The core feature is processing Word templates with placeholders:

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
- **Important**: Always use translation keys, never hardcoded strings in UI components

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
