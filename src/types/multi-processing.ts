import type { Doc } from "@junobuild/core";
import type { WordTemplateData } from "./word_template";

/**
 * Represents a single template being processed with its extracted fields
 */
export interface ProcessingTemplate {
  id: string;                                    // Unique identifier (template key or file name)
  template?: Doc<WordTemplateData>;              // For saved templates
  file?: File;                                   // For one-time files
  fileName: string;                              // Display name
  placeholders: string[];                        // {{placeholder}} fields from document
  customProperties: Record<string, string>;      // Custom properties from docProps/custom.xml
}

/**
 * Categorized field information for multi-file processing UI
 */
export interface MultiFileFieldData {
  /** Fields that appear in 2 or more files */
  sharedFields: string[];

  /** Unique fields per file (keyed by file ID) */
  fileFields: Map<string, FileFieldInfo>;

  /** Maps each field name to the list of file IDs that contain it */
  fieldToFiles: Map<string, string[]>;

  /** Tracks whether each field is a custom property (true) or placeholder (false) */
  isCustomProperty: Record<string, boolean>;
}

/**
 * Information about fields unique to a specific file
 */
export interface FileFieldInfo {
  fileName: string;
  fields: string[];
}

/**
 * Result of processing a single document
 */
export interface ProcessedDocumentResult {
  id: string;
  fileName: string;
  blob: Blob;
}
