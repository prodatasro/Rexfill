import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Doc } from '@junobuild/core';
import type { Folder } from '../types/folder';
import type { WordTemplateData } from '../types/word_template';
import {
  listDocsWithTimeout,
  setDocWithTimeout,
  deleteDocWithTimeout,
} from '../utils/junoWithTimeout';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { TimeoutError } from '../utils/fetchWithTimeout';
import { validateFolderName, buildFolderPath, buildFolderTree } from '../utils/folderUtils';
import { templateKeys } from './useTemplatesQuery';

// Query keys for cache management
export const folderKeys = {
  all: ['folders'] as const,
  lists: () => [...folderKeys.all, 'list'] as const,
  tree: (templateCount: number) => [...folderKeys.all, 'tree', templateCount] as const,
};

// Fetch all folders
async function fetchFolders(): Promise<Folder[]> {
  const result = await listDocsWithTimeout({ collection: 'folders' });
  return result.items as Folder[];
}

/**
 * Hook to fetch all folders with TanStack Query
 */
export function useFoldersQuery() {
  return useQuery({
    queryKey: folderKeys.lists(),
    queryFn: fetchFolders,
  });
}

/**
 * Hook to get folder tree with template counts
 * Combines folders and templates to build a hierarchical tree
 */
export function useFolderTreeQuery(templates: Doc<WordTemplateData>[] = []) {
  const { data: folders = [], ...rest } = useFoldersQuery();

  // Memoize the folder tree building
  const folderTree = useMemo(() => {
    return buildFolderTree(folders, templates);
  }, [folders, templates]);

  return {
    ...rest,
    folders,
    folderTree,
  };
}

/**
 * Hook for creating a new folder
 */
export function useCreateFolderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      parentId,
      folders,
    }: {
      name: string;
      parentId: string | null;
      folders: Folder[];
    }) => {
      // Validate name
      const validationError = await validateFolderName(name, parentId);
      if (validationError) {
        throw new Error(validationError);
      }

      // Get parent folder if creating subfolder
      const parentFolder = parentId
        ? folders.find((f) => f.key === parentId)
        : null;

      // Check depth limit (max 2 levels: 0 and 1)
      if (parentFolder && parentFolder.data.level >= 1) {
        throw new Error(t('folders.maxDepthReached') || 'Maximum folder depth reached');
      }

      // Build path
      const level = parentFolder ? parentFolder.data.level + 1 : 0;
      const path = buildFolderPath(name, parentFolder?.data.path || null);

      // Create folder with generated key
      const key = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newFolder: Folder = {
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
        owner: '', // Will be set by Juno
        created_at: BigInt(0),
        updated_at: BigInt(0),
        version: BigInt(0),
      };

      await setDocWithTimeout({
        collection: 'folders',
        doc: {
          key,
          data: newFolder.data,
        },
      });

      return { key, name };
    },
    onSuccess: ({ name }) => {
      showSuccessToast(t('folders.folderCreated', { name }) || `Folder "${name}" created`);
    },
    onError: (err) => {
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else if (err instanceof Error) {
        showErrorToast(err.message);
      } else {
        showErrorToast(t('folders.createFailed') || 'Failed to create folder');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
    },
  });
}

/**
 * Hook for renaming a folder with optimistic update
 */
export function useRenameFolderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folder,
      newName,
      folders,
    }: {
      folder: Folder;
      newName: string;
      folders: Folder[];
    }) => {
      // Validate new name
      const validationError = await validateFolderName(
        newName,
        folder.data.parentId,
        folder.key
      );
      if (validationError) {
        throw new Error(validationError);
      }

      const oldPath = folder.data.path;
      const parentFolder = folder.data.parentId
        ? folders.find((f) => f.key === folder.data.parentId)
        : null;
      const newPath = buildFolderPath(newName, parentFolder?.data.path || null);

      // Update the folder
      await setDocWithTimeout({
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

      // Update all subfolders' paths in parallel
      const subfolders = folders.filter((f) => f.data.parentId === folder.key);
      if (subfolders.length > 0) {
        await Promise.all(
          subfolders.map((subfolder) => {
            const newSubPath = subfolder.data.path.replace(oldPath, newPath);
            return setDocWithTimeout({
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
          })
        );
      }

      return { folder, newName, oldPath, newPath };
    },
    onMutate: async ({ folder, newName, folders }) => {
      await queryClient.cancelQueries({ queryKey: folderKeys.lists() });

      const previousFolders = queryClient.getQueryData<Folder[]>(folderKeys.lists());
      const oldPath = folder.data.path;
      const parentFolder = folder.data.parentId
        ? folders.find((f) => f.key === folder.data.parentId)
        : null;
      const newPath = buildFolderPath(newName, parentFolder?.data.path || null);

      // Optimistically update
      queryClient.setQueryData<Folder[]>(folderKeys.lists(), (old) =>
        old?.map((f) => {
          if (f.key === folder.key) {
            return {
              ...f,
              data: { ...f.data, name: newName, path: newPath, updatedAt: Date.now() },
            };
          }
          if (f.data.parentId === folder.key) {
            return {
              ...f,
              data: {
                ...f.data,
                path: f.data.path.replace(oldPath, newPath),
                updatedAt: Date.now(),
              },
            };
          }
          return f;
        }) ?? []
      );

      return { previousFolders };
    },
    onError: (err, _vars, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(folderKeys.lists(), context.previousFolders);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else if (err instanceof Error) {
        showErrorToast(err.message);
      } else {
        showErrorToast(t('folders.renameFailed') || 'Failed to rename folder');
      }
    },
    onSuccess: ({ newName }) => {
      showSuccessToast(
        t('folders.folderRenamed', { name: newName }) || `Folder renamed to "${newName}"`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      // Also invalidate templates as their paths may need updating
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a folder with optimistic update
 */
export function useDeleteFolderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folder,
      folders,
    }: {
      folder: Folder;
      folders: Folder[];
    }) => {
      // Get all subfolders
      const subfolders = folders.filter((f) => f.data.parentId === folder.key);

      // Delete all subfolders in parallel
      if (subfolders.length > 0) {
        await Promise.all(
          subfolders.map((subfolder) =>
            deleteDocWithTimeout({
              collection: 'folders',
              doc: subfolder,
            })
          )
        );
      }

      // Delete the folder itself
      await deleteDocWithTimeout({
        collection: 'folders',
        doc: folder,
      });

      return folder;
    },
    onMutate: async ({ folder, folders }) => {
      await queryClient.cancelQueries({ queryKey: folderKeys.lists() });

      const previousFolders = queryClient.getQueryData<Folder[]>(folderKeys.lists());
      const subfolderIds = new Set(
        folders.filter((f) => f.data.parentId === folder.key).map((f) => f.key)
      );

      // Optimistically remove folder and subfolders
      queryClient.setQueryData<Folder[]>(folderKeys.lists(), (old) =>
        old?.filter((f) => f.key !== folder.key && !subfolderIds.has(f.key)) ?? []
      );

      return { previousFolders };
    },
    onError: (err, _vars, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(folderKeys.lists(), context.previousFolders);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('folders.deleteFailed') || 'Failed to delete folder');
      }
    },
    onSuccess: (folder) => {
      showSuccessToast(
        t('folders.folderDeleted', { name: folder.data.name }) ||
          `Folder "${folder.data.name}" deleted`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      // Also invalidate templates as they may be affected
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Utility hook to get a folder by ID from the cache
 */
export function useFolderById(folderId: string | null) {
  const { data: folders = [] } = useFoldersQuery();

  return useMemo(() => {
    if (!folderId) return null;
    return folders.find((f) => f.key === folderId) ?? null;
  }, [folders, folderId]);
}
