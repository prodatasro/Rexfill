import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../types/word-template';
import {
  listDocsWithTimeout,
  setDocWithTimeout,
  deleteDocWithTimeout,
  deleteAssetWithTimeout,
} from '../utils/junoWithTimeout';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { TimeoutError } from '../utils/fetchWithTimeout';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts';
import { useAdmin } from '../contexts/AdminContext';

// Query keys for cache management
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters: { folderId?: string | null }) =>
    [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

// Fetch all templates
async function fetchTemplates(userKey?: string | null, isAdmin?: boolean): Promise<Doc<WordTemplateData>[]> {
  // Admin users see all templates; regular users filtered by owner
  const result = await listDocsWithTimeout({
    collection: 'templates_meta',
    ...(!isAdmin && userKey ? { filter: { owner: userKey } } : {})
  });
  return result.items as Doc<WordTemplateData>[];
}

/**
 * Hook to fetch all templates with TanStack Query
 * Provides automatic caching, background refetching, and retry logic
 * Filters templates by owner (except for admin users)
 */
export function useTemplatesQuery() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: templateKeys.lists(),
    queryFn: () => fetchTemplates(user?.key, isAdmin),
  });
}

/**
 * Hook to get templates filtered by folder
 * Uses the cached data from useTemplatesQuery
 */
export function useTemplatesByFolderQuery(folderId: string | null) {
  const { data: allTemplates = [], ...rest } = useTemplatesQuery();

  // Filter templates by folder
  const templates = allTemplates.filter((template) => {
    const templateFolderId = template.data.folderId ?? null;
    return templateFolderId === folderId;
  });

  return {
    ...rest,
    templates,
    allTemplates,
  };
}

/**
 * Hook for deleting a template with optimistic update
 */
export function useDeleteTemplateMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { decrementTemplateCount } = useSubscription();

  return useMutation({
    mutationFn: async (template: Doc<WordTemplateData>) => {
      // Delete from storage first
      if (template.data.fullPath) {
        await deleteAssetWithTimeout({
          collection: 'templates',
          fullPath: template.data.fullPath,
        });
      }
      // Delete metadata
      await deleteDocWithTimeout({
        collection: 'templates_meta',
        doc: template,
      });
      return template;
    },
    // Optimistic update - remove from cache immediately
    onMutate: async (template) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      // Snapshot the previous value
      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Optimistically update the cache
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) => old?.filter((t) => t.key !== template.key) ?? []
      );

      return { previousTemplates };
    },
    onError: (err, _template, context) => {
      // Rollback on error
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('fileList.deleteFailed'));
      }
    },
    onSuccess: async (template) => {
      // Decrement template count
      await decrementTemplateCount();
      showSuccessToast(t('fileList.deleteSuccess', { filename: template.data.name }));
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for updating template metadata with optimistic update
 */
export function useUpdateTemplateMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Doc<WordTemplateData>) => {
      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: template,
      });
      return template;
    },
    onMutate: async (template) => {
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Optimistically update the cache
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) =>
          old?.map((t) => (t.key === template.key ? template : t)) ?? []
      );

      return { previousTemplates };
    },
    onError: (err, _template, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('fileList.favoriteFailed'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for toggling template favorite status
 */
export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Doc<WordTemplateData>) => {
      const updatedTemplate = {
        ...template,
        data: {
          ...template.data,
          isFavorite: !template.data.isFavorite,
        },
      };
      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: updatedTemplate,
      });
      return updatedTemplate;
    },
    onMutate: async (template) => {
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Optimistically toggle favorite
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) =>
          old?.map((t) =>
            t.key === template.key
              ? { ...t, data: { ...t.data, isFavorite: !t.data.isFavorite } }
              : t
          ) ?? []
      );

      return { previousTemplates };
    },
    onError: (_err, _template, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for moving template to a different folder
 */
export function useMoveTemplateMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      template,
      newFolderId,
      newFolderPath,
      newFullPath,
    }: {
      template: Doc<WordTemplateData>;
      newFolderId: string | null;
      newFolderPath: string;
      newFullPath: string;
    }) => {
      const updatedTemplate = {
        ...template,
        data: {
          ...template.data,
          folderId: newFolderId,
          folderPath: newFolderPath,
          fullPath: newFullPath,
        },
      };
      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: updatedTemplate,
      });
      return updatedTemplate;
    },
    onMutate: async ({ template, newFolderId, newFolderPath, newFullPath }) => {
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Optimistically update
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) =>
          old?.map((t) =>
            t.key === template.key
              ? {
                  ...t,
                  data: {
                    ...t.data,
                    folderId: newFolderId,
                    folderPath: newFolderPath,
                    fullPath: newFullPath,
                  },
                }
              : t
          ) ?? []
      );

      return { previousTemplates };
    },
    onError: (err, _vars, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('fileList.moveFailed'));
      }
    },
    onSuccess: () => {
      showSuccessToast(t('fileList.moveSuccess'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for bulk updating templates (e.g., after folder rename)
 */
export function useBulkUpdateTemplatesMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templates: Doc<WordTemplateData>[]) => {
      // Update all templates in parallel
      await Promise.all(
        templates.map((template) =>
          setDocWithTimeout({
            collection: 'templates_meta',
            doc: template,
          })
        )
      );
      return templates;
    },
    onMutate: async (templates) => {
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Create a map for efficient lookup
      const updatedMap = new Map(templates.map((t) => [t.key, t]));

      // Optimistically update all templates
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) => old?.map((t) => updatedMap.get(t.key) ?? t) ?? []
      );

      return { previousTemplates };
    },
    onError: (err, _templates, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      }
      // Bulk update failures are silent - individual operations handle their own errors
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Hook for creating a new template with optimistic update
 */
export function useCreateTemplateMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { incrementTemplateCount } = useSubscription();

  return useMutation({
    mutationFn: async (template: Doc<WordTemplateData>) => {
      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: template,
      });
      return template;
    },
    onMutate: async (template) => {
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousTemplates = queryClient.getQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists()
      );

      // Optimistically add to cache
      queryClient.setQueryData<Doc<WordTemplateData>[]>(
        templateKeys.lists(),
        (old) => [...(old ?? []), template]
      );

      return { previousTemplates };
    },
    onError: (err, _template, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
      if (err instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('fileUpload.uploadFailed'));
      }
    },
    onSuccess: () => {
      incrementTemplateCount();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
