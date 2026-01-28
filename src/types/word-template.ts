import type { Doc } from "@junobuild/core";

export interface WordTemplateData {
  name: string;
  url?: string; // Direct download URL from storage
  fullPath?: string; // Storage path: "/folder/template.docx"
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
