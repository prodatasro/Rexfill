import type { Folder, FolderData, FolderTreeNode } from '../types/folder';
import type { WordTemplateData } from '../types/word-template';
import type { Doc } from '@junobuild/core';
import { folderRepository } from '../dal';

/**
 * Validate folder name and check for duplicates at the same level
 */
export const validateFolderName = async (
  name: string,
  parentId: string | null,
  excludeFolderId?: string
): Promise<string | null> => {
  // Check if empty
  if (!name.trim()) {
    return 'Folder name cannot be empty';
  }

  // Check length
  if (name.length > 50) {
    return 'Folder name too long (max 50 characters)';
  }

  // Check for special characters
  if (/[/\\:*?"<>|]/.test(name)) {
    return 'Invalid characters in folder name';
  }

  // Check for leading/trailing spaces
  if (name !== name.trim()) {
    return 'Remove leading/trailing spaces';
  }

  // Check for duplicates at same level
  try {
    const folders = await folderRepository.list() as Doc<FolderData>[];
    const siblings = folders.filter(
      (f) =>
        f.data.parentId === parentId && f.key !== excludeFolderId
    );

    if (siblings.some((f) => f.data.name === name)) {
      return 'A folder with this name already exists';
    }
  } catch (error) {
    console.error('Error checking for duplicate folder names:', error);
  }

  return null; // Valid
};

/**
 * Build full path for a folder based on parent path and folder name
 */
export const buildFolderPath = (
  name: string,
  parentPath: string | null
): string => {
  if (!parentPath || parentPath === '/') {
    return `/${name}`;
  }
  return `${parentPath}/${name}`;
};

/**
 * Check if a folder can have subfolders (max 2 levels)
 */
export const canCreateSubfolder = (folder: Folder): boolean => {
  return folder.data.level < 1;
};

/**
 * Get the depth level of a folder
 */
export const getFolderDepth = (folder: Folder): number => {
  return folder.data.level;
};

/**
 * Build a tree structure from a flat list of folders and count templates
 */
export const buildFolderTree = (
  folders: Folder[],
  templates: Doc<WordTemplateData>[]
): FolderTreeNode[] => {
  // Create a map for quick lookup
  const folderMap = new Map<string, FolderTreeNode>();

  // Initialize all nodes
  folders.forEach((folder) => {
    folderMap.set(folder.key, {
      folder,
      children: [],
      templateCount: 0,
    });
  });

  // Count templates per folder
  templates.forEach((template) => {
    const folderId = template.data.folderId ?? null;
    if (folderId && folderMap.has(folderId)) {
      const node = folderMap.get(folderId)!;
      node.templateCount++;
    }
  });

  // Build tree structure
  const rootNodes: FolderTreeNode[] = [];

  folders.forEach((folder) => {
    const node = folderMap.get(folder.key)!;

    if (folder.data.parentId === null) {
      // Root folder
      rootNodes.push(node);
    } else {
      // Child folder
      const parent = folderMap.get(folder.data.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    }
  });

  // Sort folders by order, then by name
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.folder.data.order !== b.folder.data.order) {
        return a.folder.data.order - b.folder.data.order;
      }
      return a.folder.data.name.localeCompare(b.folder.data.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(rootNodes);

  return rootNodes;
};

/**
 * Flatten a folder tree to get all folders in order
 */
export const flattenFolderTree = (tree: FolderTreeNode[]): Folder[] => {
  const result: Folder[] = [];

  const traverse = (node: FolderTreeNode) => {
    result.push(node.folder);
    node.children.forEach(traverse);
  };

  tree.forEach(traverse);
  return result;
};

/**
 * Get all descendant folder IDs (children, grandchildren, etc.)
 */
export const getDescendantFolderIds = (
  folderId: string,
  allFolders: Folder[]
): string[] => {
  const descendants: string[] = [];
  const queue: string[] = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allFolders.filter((f) => f.data.parentId === currentId);

    children.forEach((child) => {
      descendants.push(child.key);
      queue.push(child.key);
    });
  }

  return descendants;
};

/**
 * Count templates in a folder (including subfolders)
 */
export const countTemplatesInFolder = (
  folderId: string | null,
  templates: Doc<WordTemplateData>[],
  allFolders: Folder[],
  includeSubfolders: boolean = false
): number => {
  if (!includeSubfolders) {
    return templates.filter(
      (t) => (t.data.folderId ?? null) === folderId
    ).length;
  }

  if (folderId === null) {
    return templates.filter((t) => !t.data.folderId).length;
  }

  const descendantIds = getDescendantFolderIds(folderId, allFolders);
  const allIds = [folderId, ...descendantIds];

  return templates.filter((t) => {
    const templateFolderId = t.data.folderId ?? null;
    return templateFolderId && allIds.includes(templateFolderId);
  }).length;
};
