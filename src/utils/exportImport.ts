import PizZip from 'pizzip';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../types/word_template';
import type { Folder, FolderData } from '../types/folder';
import { buildStoragePath } from './templatePathUtils';

/**
 * Metadata structure for export
 */
export interface ExportMetadata {
  version: string;
  exportedAt: number;
  folders: FolderExportData[];
  templates: TemplateExportData[];
}

export interface FolderExportData {
  key: string;
  data: FolderData;
}

export interface TemplateExportData {
  key: string;
  data: WordTemplateData;
  filename: string; // Path in ZIP file
}

/**
 * Import conflict resolution options
 */
export type ConflictResolution = 'skip' | 'overwrite' | 'rename';

/**
 * Import result for a single item
 */
export interface ImportItemResult {
  name: string;
  type: 'folder' | 'template';
  status: 'success' | 'skipped' | 'error';
  error?: string;
  renamed?: string;
}

/**
 * Overall import result
 */
export interface ImportResult {
  success: boolean;
  totalFolders: number;
  totalTemplates: number;
  importedFolders: number;
  importedTemplates: number;
  skippedFolders: number;
  skippedTemplates: number;
  errors: string[];
  items: ImportItemResult[];
}

/**
 * Conflict detection result
 */
export interface ConflictInfo {
  folderConflicts: Array<{
    importFolder: FolderExportData;
    existingFolder: Folder;
  }>;
  templateConflicts: Array<{
    importTemplate: TemplateExportData;
    existingTemplate: Doc<WordTemplateData>;
  }>;
}

const EXPORT_VERSION = '1.0';
const METADATA_FILENAME = 'metadata.json';
const TEMPLATES_FOLDER = 'templates';

/**
 * Create an export ZIP file containing all templates and metadata
 */
export async function createExportZip(
  templates: Doc<WordTemplateData>[],
  folders: Folder[],
  fetchTemplateBlob: (template: Doc<WordTemplateData>) => Promise<Blob | null>
): Promise<Blob> {
  const zip = new PizZip();

  // Create templates folder in ZIP
  const templatesFolder = zip.folder(TEMPLATES_FOLDER);
  if (!templatesFolder) {
    throw new Error('Failed to create templates folder in ZIP');
  }

  // Prepare metadata
  const templateExports: TemplateExportData[] = [];

  // Add each template file to the ZIP
  for (const template of templates) {
    const blob = await fetchTemplateBlob(template);
    if (!blob) {
      console.warn(`Failed to fetch template: ${template.data.name}`);
      continue;
    }

    // Generate unique filename in ZIP based on fullPath or key
    const zipFilename = template.data.fullPath
      ? buildStoragePath(template.data.fullPath)
      : template.key;

    // Add file to ZIP
    const arrayBuffer = await blob.arrayBuffer();
    templatesFolder.file(zipFilename, arrayBuffer);

    templateExports.push({
      key: template.key,
      data: template.data,
      filename: `${TEMPLATES_FOLDER}/${zipFilename}`,
    });
  }

  // Prepare folder exports
  const folderExports: FolderExportData[] = folders.map((folder) => ({
    key: folder.key,
    data: folder.data,
  }));

  // Create metadata
  const metadata: ExportMetadata = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    folders: folderExports,
    templates: templateExports,
  };

  // Add metadata to ZIP
  zip.file(METADATA_FILENAME, JSON.stringify(metadata, null, 2));

  // Generate ZIP blob
  const content = zip.generate({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }) as Blob;

  return content;
}

/**
 * Parse an import ZIP file and extract metadata
 */
export async function parseImportZip(
  file: File
): Promise<{ metadata: ExportMetadata; zip: PizZip }> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  // Read metadata
  const metadataFile = zip.file(METADATA_FILENAME);
  if (!metadataFile) {
    throw new Error('Invalid backup file: metadata.json not found');
  }

  const metadataContent = metadataFile.asText();
  const metadata: ExportMetadata = JSON.parse(metadataContent);

  // Validate version
  if (!metadata.version) {
    throw new Error('Invalid backup file: missing version');
  }

  return { metadata, zip };
}

/**
 * Detect conflicts between import data and existing data
 */
export function detectConflicts(
  metadata: ExportMetadata,
  existingTemplates: Doc<WordTemplateData>[],
  existingFolders: Folder[]
): ConflictInfo {
  const folderConflicts: ConflictInfo['folderConflicts'] = [];
  const templateConflicts: ConflictInfo['templateConflicts'] = [];

  // Check folder conflicts by path (not key)
  for (const importFolder of metadata.folders) {
    const existing = existingFolders.find(
      (f) => f.data.path === importFolder.data.path
    );
    if (existing) {
      folderConflicts.push({
        importFolder,
        existingFolder: existing,
      });
    }
  }

  // Check template conflicts by fullPath or name+folderId
  for (const importTemplate of metadata.templates) {
    const existing = existingTemplates.find((t) => {
      // Match by fullPath if available
      if (importTemplate.data.fullPath && t.data.fullPath) {
        return t.data.fullPath === importTemplate.data.fullPath;
      }
      // Otherwise match by name and folderId
      return (
        t.data.name === importTemplate.data.name &&
        (t.data.folderId || null) === (importTemplate.data.folderId || null)
      );
    });
    if (existing) {
      templateConflicts.push({
        importTemplate,
        existingTemplate: existing,
      });
    }
  }

  return { folderConflicts, templateConflicts };
}

/**
 * Generate a unique name by adding a suffix
 */
export function generateUniqueName(
  baseName: string,
  existingNames: string[],
  isFolder: boolean = false
): string {
  let newName = baseName;
  let counter = 1;

  // For folders, just append number
  // For files, insert before extension
  if (isFolder) {
    while (existingNames.includes(newName)) {
      newName = `${baseName} (${counter})`;
      counter++;
    }
  } else {
    const dotIndex = baseName.lastIndexOf('.');
    const nameWithoutExt = dotIndex > 0 ? baseName.substring(0, dotIndex) : baseName;
    const ext = dotIndex > 0 ? baseName.substring(dotIndex) : '';

    while (existingNames.includes(newName)) {
      newName = `${nameWithoutExt} (${counter})${ext}`;
      counter++;
    }
  }

  return newName;
}

/**
 * Extract a template file from the ZIP
 */
export function extractTemplateFromZip(
  zip: PizZip,
  templateData: TemplateExportData
): ArrayBuffer | null {
  const file = zip.file(templateData.filename);
  if (!file) {
    console.warn(`Template file not found in ZIP: ${templateData.filename}`);
    return null;
  }

  return file.asArrayBuffer();
}

/**
 * Create a File object from template data in ZIP
 */
export function createFileFromZip(
  zip: PizZip,
  templateData: TemplateExportData
): File | null {
  const arrayBuffer = extractTemplateFromZip(zip, templateData);
  if (!arrayBuffer) {
    return null;
  }

  return new File([arrayBuffer], templateData.data.name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(prefix: string = 'rexfill-backup'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `${prefix}-${dateStr}-${timeStr}.zip`;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate that a file is a valid ZIP
 */
export async function validateZipFile(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    new PizZip(arrayBuffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build folder path mapping from imported folders to handle parent references
 */
export function buildFolderKeyMapping(
  importedFolders: FolderExportData[],
  existingFolders: Folder[],
  resolution: ConflictResolution,
  renamedFolders: Map<string, string> // oldKey -> newKey
): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const importFolder of importedFolders) {
    const existing = existingFolders.find(
      (f) => f.data.path === importFolder.data.path
    );

    if (existing) {
      if (resolution === 'skip') {
        // Map to existing folder key
        mapping.set(importFolder.key, existing.key);
      } else if (resolution === 'overwrite') {
        // Will be updated in place, keep same key
        mapping.set(importFolder.key, existing.key);
      } else if (resolution === 'rename') {
        // New key will be generated
        const newKey = renamedFolders.get(importFolder.key) || importFolder.key;
        mapping.set(importFolder.key, newKey);
      }
    } else {
      // No conflict, use original key
      mapping.set(importFolder.key, importFolder.key);
    }
  }

  return mapping;
}
