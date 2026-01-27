import type { Doc } from "@junobuild/core";

export interface WordTemplateData {
  name: string;
  url?: string; // Deprecated: Use fullPath + accessToken instead
  fullPath?: string; // Storage path: "/folder/template.docx"
  accessToken?: string; // Secure token for URL construction
  size: number;
  uploadedAt: number;
  mimeType: string;

  // Folder fields for organizing templates
  folderId?: string | null;        // Reference to folder key, null for root
  folderPath?: string;             // Denormalized path for efficient querying: "/Legal/Contracts"

  // User preferences
  isFavorite?: boolean;            // Whether template is marked as favorite

  // Custom property metadata (extracted during upload)
  customPropertyCount?: number;    // Number of custom properties in docProps/custom.xml
}

export type WordTemplate = Doc<WordTemplateData>;
