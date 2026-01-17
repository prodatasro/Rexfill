import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { listDocs, setDoc, deleteDoc } from '@junobuild/core';
import type { Folder } from '../types/folder';
import type { Doc } from '@junobuild/core';
import { validateFolderName, buildFolderPath, buildFolderTree } from '../utils/folderUtils';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';

export const useFolders = (templates: Doc<any>[] = []) => {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cache keys for memoization
  const prevFolderKeysRef = useRef<string>('');
  const prevTemplateCountRef = useRef<number>(0);

  // Memoize folder tree building - only rebuild when folders or template counts change
  const folderTree = useMemo(() => {
    // Create a stable key from folder IDs and template folder assignments
    const folderKeys = folders.map(f => f.key).sort().join(',');
    const templateFolderCounts = templates.reduce((acc, t) => {
      const folderId = t.data?.folderId || 'root';
      acc[folderId] = (acc[folderId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const templateCountKey = Object.entries(templateFolderCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    const cacheKey = `${folderKeys}|${templateCountKey}`;

    // Skip rebuild if nothing changed
    if (cacheKey === prevFolderKeysRef.current && templates.length === prevTemplateCountRef.current) {
      // Return previous value - React will reuse the memoized result
    }

    prevFolderKeysRef.current = cacheKey;
    prevTemplateCountRef.current = templates.length;

    return buildFolderTree(folders, templates);
  }, [folders, templates]);

  // Load all folders from Juno
  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDocs({ collection: 'folders' });
      const folderList = result.items as Folder[];
      setFolders(folderList);
    } catch (err) {
      console.error('Failed to load folders:', err);
      setError('Failed to load folders');
      showErrorToast(t('folders.loadFailed') || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Create a new folder - returns the created folder's key on success, null on failure
  const createFolder = useCallback(
    async (name: string, parentId: string | null): Promise<string | null> => {
      // Validate name
      const validationError = await validateFolderName(name, parentId);
      if (validationError) {
        showErrorToast(validationError);
        return null;
      }

      // Get parent folder if creating subfolder
      const parentFolder = parentId
        ? folders.find((f) => f.key === parentId)
        : null;

      // Check depth limit (max 2 levels: 0 and 1)
      if (parentFolder && parentFolder.data.level >= 1) {
        showErrorToast(t('folders.maxDepthReached') || 'Maximum folder depth reached');
        return null;
      }

      // Build path
      const level = parentFolder ? parentFolder.data.level + 1 : 0;
      const path = buildFolderPath(name, parentFolder?.data.path || null);

      setCreating(true);
      try {
        // Create folder with generated key
        const key = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await setDoc({
          collection: 'folders',
          doc: {
            key,
            data: {
              name,
              parentId,
              path,
              level,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              order: 0,
            },
          },
        });

        showSuccessToast(t('folders.folderCreated', { name }) || `Folder "${name}" created`);
        await loadFolders();
        return key;
      } catch (err) {
        console.error('Failed to create folder:', err);
        showErrorToast(t('folders.createFailed') || 'Failed to create folder');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [folders, loadFolders, t]
  );

  // Rename a folder
  const renameFolder = useCallback(
    async (folderId: string, newName: string): Promise<boolean> => {
      const folder = folders.find((f) => f.key === folderId);
      if (!folder) {
        showErrorToast('Folder not found');
        return false;
      }

      // Validate new name
      const validationError = await validateFolderName(
        newName,
        folder.data.parentId,
        folderId
      );
      if (validationError) {
        showErrorToast(validationError);
        return false;
      }

      const oldPath = folder.data.path;
      const parentFolder = folder.data.parentId
        ? folders.find((f) => f.key === folder.data.parentId)
        : null;
      const newPath = buildFolderPath(newName, parentFolder?.data.path || null);

      setRenaming(true);
      try {
        // Update folder
        await setDoc({
          collection: 'folders',
          doc: {
            ...folder,
            data: {
              ...folder.data,
              name: newName,
              path: newPath,
              updatedAt: Date.now(),
            },
          },
        });

        // Update all subfolders' paths
        const subfolders = folders.filter((f) => f.data.parentId === folderId);
        for (const subfolder of subfolders) {
          const newSubPath = subfolder.data.path.replace(oldPath, newPath);
          await setDoc({
            collection: 'folders',
            doc: {
              ...subfolder,
              data: {
                ...subfolder.data,
                path: newSubPath,
                updatedAt: Date.now(),
              },
            },
          });
        }

        // Note: Templates will be updated by the component that calls this
        // because it has access to the templates state

        showSuccessToast(t('folders.folderRenamed', { name: newName }) || `Folder renamed to "${newName}"`);
        await loadFolders();
        return true;
      } catch (err) {
        console.error('Failed to rename folder:', err);
        showErrorToast(t('folders.renameFailed') || 'Failed to rename folder');
        return false;
      } finally {
        setRenaming(false);
      }
    },
    [folders, loadFolders, t]
  );

  // Delete a folder and all its contents
  const deleteFolder = useCallback(
    async (folderId: string): Promise<boolean> => {
      const folder = folders.find((f) => f.key === folderId);
      if (!folder) {
        showErrorToast('Folder not found');
        return false;
      }

      setDeleting(true);
      try {
        // Get all subfolders
        const subfolders = folders.filter((f) => f.data.parentId === folderId);

        // Delete all subfolders
        for (const subfolder of subfolders) {
          await deleteDoc({
            collection: 'folders',
            doc: subfolder,
          });
        }

        // Delete the folder itself
        await deleteDoc({
          collection: 'folders',
          doc: folder,
        });

        // Note: Templates will be deleted by the component that calls this
        // because it has access to the templates state and needs to delete from storage

        showSuccessToast(t('folders.folderDeleted', { name: folder.data.name }) || `Folder "${folder.data.name}" deleted`);
        await loadFolders();
        return true;
      } catch (err) {
        console.error('Failed to delete folder:', err);
        showErrorToast(t('folders.deleteFailed') || 'Failed to delete folder');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [folders, loadFolders, t]
  );

  // Get folder by ID
  const getFolderById = useCallback(
    (folderId: string | null): Folder | null => {
      if (!folderId) return null;
      return folders.find((f) => f.key === folderId) || null;
    },
    [folders]
  );

  return {
    folders,
    folderTree,
    loading,
    error,
    creating,
    renaming,
    deleting,
    loadFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolderById,
  };
};
