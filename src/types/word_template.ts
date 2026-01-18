import type { Doc } from "@junobuild/core";

export interface WordTemplateData {
  name: string;
  url?: string;
  size: number;
  uploadedAt: number;
  mimeType: string;

  // Folder fields for organizing templates
  folderId?: string | null;        // Reference to folder key, null for root
  folderPath?: string;             // Denormalized path for efficient querying: "/Legal/Contracts"
  fullPath?: string;               // Complete path including filename: "/Legal/Contracts/template.docx"

  // User preferences
  isFavorite?: boolean;            // Whether template is marked as favorite

  // Placeholder metadata (extracted during upload)
  placeholderCount?: number;       // Number of {{}} placeholders in the template
  customPropertyCount?: number;    // Number of custom properties in docProps/custom.xml

  // Default field values (saved by user for pre-filling forms)
  defaultValues?: Record<string, string>;  // Map of placeholder name to default value
}

export type WordTemplate = Doc<WordTemplateData>;
