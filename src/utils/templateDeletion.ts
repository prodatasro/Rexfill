import { Doc } from '@junobuild/core';
import { deleteAssetWithTimeout, listAssetsWithTimeout, deleteDocWithTimeout } from './junoWithTimeout';
import { WordTemplateData } from '../types/word_template';
import { FolderTreeNode } from '../types/folder';

/**
 * Get all subfolder IDs recursively from a given folder ID
 */
export function getAllSubfolderIds(folderId: string, folderTree: FolderTreeNode[]): string[] {
  const findInTree = (nodes: FolderTreeNode[]): string[] => {
    for (const node of nodes) {
      if (node.folder.key === folderId) {
        // Found the folder, collect all descendant IDs
        const collectIds = (n: FolderTreeNode): string[] => {
          const ids = [n.folder.key];
          for (const child of n.children) {
            ids.push(...collectIds(child));
          }
          return ids;
        };
        return collectIds(node);
      }
      const found = findInTree(node.children);
      if (found.length > 0) return found;
    }
    return [];
  };
  return findInTree(folderTree);
}

/**
 * Build a map of storage assets for efficient lookup by various path formats
 */
export async function buildStorageAssetMap(): Promise<Map<string, { fullPath: string }>> {
  const storageAssets = await listAssetsWithTimeout({
    collection: 'templates',
    filter: {}
  });

  const storageAssetMap = new Map<string, { fullPath: string }>();

  for (const asset of storageAssets.items) {
    const junoFullPath = asset.fullPath; // e.g., /templates/tt/file.docx

    // Map by full Juno path
    storageAssetMap.set(junoFullPath, asset);

    // Map by path without collection prefix (e.g., /tt/file.docx)
    const pathWithoutCollection = junoFullPath.replace(/^\/templates/, '');
    storageAssetMap.set(pathWithoutCollection, asset);

    // Map by path without leading slash (e.g., tt/file.docx)
    const pathNoLeadingSlash = pathWithoutCollection.startsWith('/')
      ? pathWithoutCollection.substring(1)
      : pathWithoutCollection;
    storageAssetMap.set(pathNoLeadingSlash, asset);

    // Map by just the filename (for fallback)
    const filename = junoFullPath.split('/').pop() || '';
    if (filename && !storageAssetMap.has(filename)) {
      storageAssetMap.set(filename, asset);
    }
  }

  return storageAssetMap;
}

/**
 * Delete a single template (both storage asset and metadata)
 * @returns true if successfully deleted, false otherwise
 */
export async function deleteTemplate(
  template: Doc<WordTemplateData>,
  storageAssetMap: Map<string, { fullPath: string }>
): Promise<boolean> {
  // Try to find the asset in storage using various path strategies
  const possibleKeys = [
    template.key, // Primary: the storage key (e.g., "tt/file.docx")
    `/${template.key}`, // With leading slash
    template.data.fullPath, // From metadata
    `/templates/${template.key}`, // Full Juno path
    template.data.name, // Just filename
  ].filter(Boolean);

  let assetDeleted = false;

  for (const key of possibleKeys) {
    if (!key) continue;

    const storageAsset = storageAssetMap.get(key);

    if (storageAsset) {
      try {
        await deleteAssetWithTimeout({
          collection: 'templates',
          fullPath: storageAsset.fullPath
        });
        assetDeleted = true;
        console.log(`Deleted asset: ${storageAsset.fullPath}`);
        break;
      } catch (assetError) {
        console.warn(`Failed to delete asset with path ${storageAsset.fullPath}:`, assetError);
        continue;
      }
    }
  }

  if (!assetDeleted) {
    console.warn(`Could not delete asset for ${template.data.name} from storage, deleting metadata only`);
  }

  // Always delete metadata
  await deleteDocWithTimeout({
    collection: 'templates_meta',
    doc: template
  });

  return assetDeleted;
}

/**
 * Delete multiple templates
 * @returns number of successfully deleted templates
 */
export async function deleteTemplates(
  templates: Doc<WordTemplateData>[],
  storageAssetMap?: Map<string, { fullPath: string }>
): Promise<number> {
  // Build storage map if not provided
  const assetMap = storageAssetMap || await buildStorageAssetMap();

  let deletedCount = 0;

  for (const template of templates) {
    try {
      await deleteTemplate(template, assetMap);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete template ${template.data.name}:`, error);
    }
  }

  return deletedCount;
}
