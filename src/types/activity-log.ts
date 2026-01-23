/**
 * Activity log entry for tracking template and folder operations
 */
export interface ActivityLogData {
  /** Timestamp when the action occurred (milliseconds since epoch) */
  timestamp: number;
  
  /** Type of action performed */
  action: 'created' | 'updated' | 'deleted' | 'renamed' | 'moved' | 'downloaded' | 'processed_onetime';
  
  /** Type of resource being logged */
  resource_type: 'template' | 'folder' | 'onetime_file';
  
  /** Unique identifier of the resource */
  resource_id: string;
  
  /** Name of the resource at the time of the action */
  resource_name: string;
  
  /** Principal ID of the user who created the resource */
  created_by: string;
  
  /** Principal ID of the user who performed the action */
  modified_by: string;
  
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Previous value (for rename/move operations) */
  old_value?: string;
  
  /** New value (for rename/move operations) */
  new_value?: string;
  
  /** File size in bytes (for templates) */
  file_size?: number;
  
  /** Folder path (for templates) */
  folder_path?: string;
  
  /** MIME type (for templates) */
  mime_type?: string;
  
  /** Error message if operation failed */
  error_message?: string;

  /** SHA-256 hash of the file (for one-time processing) */
  file_hash?: string;

  /** List of field names that were filled (for one-time processing) */
  fields_filled?: string[];

  /** Processing duration in milliseconds (for one-time processing) */
  processing_duration_ms?: number;

  /** Number of custom properties in the document (for one-time processing) */
  custom_properties_count?: number;
}
