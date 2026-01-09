/**
 * Build full template path including folder path and filename
 */
export const buildTemplatePath = (
  folderPath: string,
  filename: string
): string => {
  // Ensure folderPath starts with / and doesn't end with /
  const normalizedPath = folderPath === '/' ? '' : folderPath;
  return `${normalizedPath}/${filename}`;
};

/**
 * Build storage path for Juno Storage
 */
export const buildStoragePath = (fullPath: string): string => {
  // Remove leading slash if present for storage
  return fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;
};

/**
 * Extract folder path from full template path
 */
export const extractFolderPath = (fullPath: string): string => {
  const lastSlashIndex = fullPath.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return '/';
  }
  return fullPath.substring(0, lastSlashIndex);
};

/**
 * Extract filename from full template path
 */
export const extractFilename = (fullPath: string): string => {
  const lastSlashIndex = fullPath.lastIndexOf('/');
  return fullPath.substring(lastSlashIndex + 1);
};

/**
 * Update template path when folder is renamed
 */
export const updateTemplatePathAfterRename = (
  oldFullPath: string,
  oldFolderPath: string,
  newFolderPath: string
): string => {
  return oldFullPath.replace(oldFolderPath, newFolderPath);
};

/**
 * Normalize folder path (ensure it starts with / and doesn't end with /)
 */
export const normalizeFolderPath = (path: string): string => {
  if (!path || path === '/') return '/';

  // Add leading slash if missing
  let normalized = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing slash if present
  if (normalized.endsWith('/') && normalized !== '/') {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
};
