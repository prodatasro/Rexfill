import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Doc } from '@junobuild/core';
import type { Folder } from '../types/folder';
import type { WordTemplateData } from '../types/word-template';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { TimeoutError } from '../utils/fetchWithTimeout';
import { validateFolderName, buildFolderPath, buildFolderTree } from '../utils/folderUtils';
import { templateKeys } from './useTemplatesQuery';
import { useAuth } from '../contexts';
import { useAdmin } from '../contexts/AdminContext';
import { folderRepository } from '../dal';

// Query keys for cache management
export const folderKeys = {
  all: ['folders'] as const,
  lists: () => [...folderKeys.all, 'list'] as const,
  tree: (templateCount: number) => [...folderKeys.all, 'tree', templateCount] as const,
};

// Fetch all folders
async function fetchFolders(userKey?: string | null, isAdmin?: boolean): Promise<Folder[]> {
  const items = await folderRepository.list() as Folder[];
  
  // Admin users see all folders; regular users see only their own
  if (isAdmin || !userKey) {
    return items;
  }
  
  // Filter to show only user's own folders as a client-side safety layer
  return items.filter(item => item.owner === userKey);
}

/**
 * Hook to fetch all folders with TanStack Query
 * Filters folders by owner (except for admin users)
 */
export function useFoldersQuery() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: folderKeys.lists(),
    queryFn: () => fetchFolders(user?.key, isAdmin),
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

      const folderData = {
        name,
        parentId,
        path,
        level,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: 0,
      };

      // Assume user.key as owner (will be set properly by repository)
      await folderRepository.createFolder(
        key,
        folderData,
        '' // Owner will be set by Juno
      );

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
      await folderRepository.update(
        folder.key,
        {
          ...folder.data,
          name: newName,
          path: newPath,
          updatedAt: Date.now(),
        },
        folder.version
      );

      // Update all subfolders' paths in parallel
      const subfolders = folders.filter((f) => f.data.parentId === folder.key);
      if (subfolders.length > 0) {
        await Promise.all(
          subfolders.map((subfolder) => {
            const newSubPath = subfolder.data.path.replace(oldPath, newPath);
            return folderRepository.update(
              subfolder.key,
              {
                ...subfolder.data,
                path: newSubPath,
                updatedAt: Date.now(),
              },
              subfolder.version
            );
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
      // Use repository's recursive delete which handles subfolders
      await folderRepository.deleteRecursive(folder.key, folder.owner);
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
