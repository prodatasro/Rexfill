import type { Doc } from "@junobuild/core";

export interface FolderData {
  name: string;                    // Folder name (e.g., "Legal Documents")
  parentId: string | null;         // null for root folders, folder key for subfolders
  path: string;                    // Full path: "/Legal Documents" or "/Legal/Contracts"
  level: number;                   // 0 for root, 1 for subfolder (enforces 2-level limit)
  createdAt: number;               // Timestamp
  updatedAt: number;               // Timestamp for tracking renames
  order: number;                   // For manual ordering in UI
}

export type Folder = Doc<FolderData>;

// Helper type for tree structure
export interface FolderTreeNode {
  folder: Folder;
  children: FolderTreeNode[];
  templateCount: number;          // Cached count of templates in this folder
}
