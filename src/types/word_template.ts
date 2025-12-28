import type { Doc } from "@junobuild/core";

export interface WordTemplateData {
  name: string;
  url?: string;
  size: number;
  uploadedAt: number;
  mimeType: string;
}

export type WordTemplate = Doc<WordTemplateData>;
