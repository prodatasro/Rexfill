/**
 * Activity log entry for tracking template and folder operations
 */
export interface ActivityLogData {
  /** Timestamp when the action occurred (milliseconds since epoch) */
  timestamp: number;
  
  /** Type of action performed */
  action: 'created' | 'updated' | 'deleted' | 'renamed' | 'moved' | 'downloaded';
  
  /** Type of resource being logged */
  resource_type: 'template' | 'folder';
  
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
}
