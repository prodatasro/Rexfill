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
}

export type WordTemplate = Doc<WordTemplateData>;
