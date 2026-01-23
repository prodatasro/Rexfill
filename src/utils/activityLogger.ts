import { Doc } from '@junobuild/core';
import { ActivityLogData } from '../types/activity-log';
import { setDocWithTimeout, listDocsWithTimeout } from './junoWithTimeout';

/**
 * Log an activity to the activity_logs collection
 * Wrapped in try-catch to ensure logging failures don't break user operations
 */
export async function logActivity(
  logData: Omit<ActivityLogData, 'timestamp'>
): Promise<void> {
  try {
    const data: ActivityLogData = {
      ...logData,
      timestamp: Date.now(),
    };

    await setDocWithTimeout({
      collection: 'activity_logs',
      doc: {
        key: `${logData.resource_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data,
      },
    });
  } catch (error) {
    // Silent failure - logging should not break user operations
    console.warn('Failed to log activity:', error);
  }
}

/**
 * Fetch all activity logs for a specific resource
 * Returns logs sorted by timestamp (newest first)
 */
export async function fetchLogsForResource(
  resourceId: string
): Promise<Doc<ActivityLogData>[]> {
  try {
    const { items } = await listDocsWithTimeout<ActivityLogData>({
      collection: 'activity_logs',
      filter: {},
    });

    // Filter by resource_id and sort by timestamp descending
    const logs = items
      .filter((log) => log.data.resource_id === resourceId)
      .sort((a, b) => b.data.timestamp - a.data.timestamp);

    return logs;
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    throw error;
  }
}

/**
 * Fetch all activity logs
 * Returns all logs sorted by timestamp (newest first)
 */
export async function fetchAllLogs(): Promise<Doc<ActivityLogData>[]> {
  try {
    const { items } = await listDocsWithTimeout<ActivityLogData>({
      collection: 'activity_logs',
      filter: {},
    });

    // Sort by timestamp descending
    const logs = items.sort((a, b) => b.data.timestamp - a.data.timestamp);

    return logs;
  } catch (error) {
    console.error('Failed to fetch all logs:', error);
    throw error;
  }
}

/**
 * Fetch only one-time processing logs
 * Returns logs for ephemeral file processing sorted by timestamp (newest first)
 */
export async function fetchOneTimeProcessingLogs(): Promise<Doc<ActivityLogData>[]> {
  try {
    const allLogs = await fetchAllLogs();
    return allLogs.filter((log) => log.data.resource_type === 'onetime_file');
  } catch (error) {
    console.error('Failed to fetch one-time processing logs:', error);
    throw error;
  }
}

/**
 * Compute SHA-256 hash of a file for audit purposes
 * Returns first 16 characters of the hash for display, full hash for storage
 */
export async function computeFileHash(arrayBuffer: ArrayBuffer): Promise<{ full: string; short: string }> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return {
    full: fullHash,
    short: fullHash.substring(0, 16)
  };
}

/**
 * Format timestamp to local date/time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string | number | boolean | undefined): string {
  if (field === undefined || field === null) {
    return '';
  }
  
  const stringField = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Generate CSV content from activity logs
 */
export function generateLogCSV(
  logs: Doc<ActivityLogData>[],
  translations: {
    timestamp: string;
    action: string;
    status: string;
    resource: string;
    details: string;
    createdBy: string;
    modifiedBy: string;
    error: string;
  }
): string {
  // CSV Headers
  const headers = [
    translations.timestamp,
    translations.action,
    translations.status,
    translations.resource,
    translations.details,
    translations.createdBy,
    translations.modifiedBy,
    translations.error,
  ];

  // CSV Rows
  const rows = logs.map((log) => {
    const data = log.data;
    
    // Build details field
    let details = '';
    if (data.action === 'renamed' && data.old_value && data.new_value) {
      details = `${data.old_value} → ${data.new_value}`;
    } else if (data.action === 'moved' && data.old_value && data.new_value) {
      details = `${data.old_value} → ${data.new_value}`;
    } else if (data.file_size !== undefined) {
      details = `${formatFileSize(data.file_size)}`;
    }
    if (data.folder_path) {
      details += details ? ` (${data.folder_path})` : data.folder_path;
    }

    return [
      formatTimestamp(data.timestamp),
      data.action,
      data.success ? 'Success' : 'Failed',
      data.resource_name,
      details,
      data.created_by,
      data.modified_by,
      data.error_message || '',
    ];
  });

  // Combine headers and rows
  const csvLines = [
    headers.map(escapeCSVField).join(','),
    ...rows.map((row) => row.map(escapeCSVField).join(',')),
  ];

  return csvLines.join('\n');
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Download logs as CSV file
 */
export function downloadLogCSV(
  csvContent: string,
  resourceName: string
): void {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${sanitizeFilename(resourceName)}-activity-log-${date}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Sanitize filename for safe file download
 */
function sanitizeFilename(filename: string): string {
  // Remove file extension if present
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Replace invalid characters with underscore
  return nameWithoutExt.replace(/[<>:"/\\|?*]/g, '_');
}
