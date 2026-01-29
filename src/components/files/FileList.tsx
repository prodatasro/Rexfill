import { FC, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ClipboardList, Search, ChevronLeft, ChevronRight, X, Loader2, Star, Trash2, CheckSquare, Square } from 'lucide-react';
import { Doc, setDoc, getDoc, deleteDoc } from '@junobuild/core';
import { WordTemplateData } from '../../types/word-template';
import type { FolderTreeNode } from '../../types/folder';
import LoadingSpinner from '../ui/LoadingSpinner';
import FileListItem from './FileListItem';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toast';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTranslation } from 'react-i18next';
import TemplateMoveDialog from '../dialogs/TemplateMoveDialog';
import TemplateRenameDialog from '../dialogs/TemplateRenameDialog';
import TemplateDuplicateDialog from '../dialogs/TemplateDuplicateDialog';
import DocxPreviewModal from '../modals/DocxPreviewModal';
import { buildTemplatePath } from '../../utils/templatePathUtils';
import { useDebounce } from '../../hooks/useDebounce';
import { useMoveTemplateMutation, useUpdateTemplateMutation, useToggleFavoriteMutation, useCreateTemplateMutation } from '../../hooks/useTemplatesQuery';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { fetchLogsForResource, generateLogCSV, downloadLogCSV, logActivity } from '../../utils/activityLogger';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { nanoid } from 'nanoid';
import { templateRepository, templateStorage } from '../../dal';

// Type for download request document data
interface DownloadRequestData {
  requestType: 'download' | 'export';
  status: 'pending' | 'approved' | 'rejected';
  templateIds: string[];
  approvedTemplateIds?: string[];
  createdAt: number;
  error?: {
    code: string;
    message: string;
    limit?: number;
    used?: number;
    retryAfterSeconds?: number;
  };
}

// Threshold for enabling virtualization - only virtualize when we have many items
const VIRTUALIZATION_THRESHOLD = 20;
// Estimated height of each FileListItem row (in pixels)
const ROW_HEIGHT_ESTIMATE = 64;

type SortField = 'name' | 'size' | 'createdOn' | 'favorite';
type SortDirection = 'asc' | 'desc';

interface FileListProps {
  templates: Doc<WordTemplateData>[];
  allTemplates: Doc<WordTemplateData>[];
  loading: boolean;
  onTemplateSelect: (template: Doc<WordTemplateData>) => void;
  onMultiTemplateSelect?: (templates: Doc<WordTemplateData>[]) => void;
  onFileDeleted: () => void;
  onRemoveFromRecent?: (id: string) => void;
  onFolderSelect?: (folderId: string | null) => void;
  selectedFolderId: string | null;
  folderTree: FolderTreeNode[];
}

const FileList: FC<FileListProps> = ({
  templates,
  allTemplates,
  loading,
  onTemplateSelect,
  onMultiTemplateSelect,
  onFileDeleted,
  onRemoveFromRecent,
  onFolderSelect,
  selectedFolderId,
  folderTree
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showUpgradePrompt, decrementTemplateCount } = useSubscription();
  const moveTemplateMutation = useMoveTemplateMutation();
  const updateTemplateMutation = useUpdateTemplateMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const createTemplateMutation = useCreateTemplateMutation();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [togglingFavoriteIds, setTogglingFavoriteIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadingLogsIds, setDownloadingLogsIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [templateToMove, setTemplateToMove] = useState<Doc<WordTemplateData> | null>(null);
  const [templateToRename, setTemplateToRename] = useState<Doc<WordTemplateData> | null>(null);
  const [templateToDuplicate, setTemplateToDuplicate] = useState<Doc<WordTemplateData> | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { confirm } = useConfirm();

  // Multi-select state
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Search, sort, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const handleDownload = async (template: Doc<WordTemplateData>) => {
    // Polling-based validation with request document
    setDownloadingIds(prev => new Set([...prev, template.key]));
    let requestKey: string | null = null;
    let requestDoc: Doc<DownloadRequestData> | null = null;
    
    try {
      if (!user) {
        showErrorToast(t('auth.pleaseSignIn'));
        return;
      }

      // 1. Create download request document
      requestKey = `${user.key}_${Date.now()}_${nanoid()}`;
      await setDoc<DownloadRequestData>({
        collection: 'download_requests',
        doc: {
          key: requestKey,
          data: {
            requestType: 'download',
            status: 'pending',
            templateIds: [template.key],
            createdAt: Date.now(),
          },
        },
      });

      // 2. Poll for request status (500ms intervals, 10s timeout)
      const pollStartTime = Date.now();
      const pollTimeout = 10000; // 10 seconds
      const pollInterval = 500; // 500ms
      
      while (Date.now() - pollStartTime < pollTimeout) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const doc = await getDoc<DownloadRequestData>({
          collection: 'download_requests',
          key: requestKey,
        });

        if (doc && doc.data.status !== 'pending') {
          requestDoc = doc;
          break;
        }
      }

      // 3. Handle timeout
      if (!requestDoc || requestDoc.data.status === 'pending') {
        showErrorToast(t('fileList.serverBusy'));
        return;
      }

      // 4. Handle rejection
      if (requestDoc.data.status === 'rejected') {
        const error = requestDoc.data.error;
        
        if (error?.code === 'subscription_expired') {
          showErrorToast(error.message);
          showUpgradePrompt();
          return;
        }
        
        if (error?.code === 'quota_exceeded') {
          showErrorToast(`${error.message} (${error.used}/${error.limit})`);
          showUpgradePrompt();
          return;
        }
        
        if (error?.code === 'rate_limit') {
          showWarningToast(`${error.message} (retry in ${error.retryAfterSeconds}s)`);
          return;
        }
        
        showErrorToast(error?.message || t('fileList.downloadFailed'));
        return;
      }

      // 5. Download approved - fetch template metadata to get download URL
      const templateMeta = await templateRepository.get(template.key);

      if (!templateMeta || !templateMeta.data.url) {
        showErrorToast(t('fileList.downloadFailed'));
        return;
      }

      // 6. Fetch the file using Juno's generated URL
      const response = await fetchWithTimeout(templateMeta.data.url);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      // 8. Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.data.name;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Log successful download
      await logActivity({
        action: 'downloaded',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: true,
        file_size: template.data.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });

      showSuccessToast(t('fileList.downloadSuccess', { filename: template.data.name }));
    } catch (error) {
      console.error('Download failed:', error);
      
      // Log failed download
      await logActivity({
        action: 'downloaded',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        file_size: template.data.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });
      
      showErrorToast(t('fileList.downloadFailed'));
    } finally {
      // 9. Delete request document with retries (3 attempts with exponential backoff)
      if (requestDoc) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await deleteDoc({
              collection: 'download_requests',
              doc: requestDoc,
            });
            break; // Success, exit retry loop
          } catch (deleteError) {
            console.warn(`Failed to delete request document (attempt ${attempt + 1}/3):`, deleteError);
            if (attempt < 2) {
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
          }
        }
      }
      
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  };

  const handleDelete = async (template: Doc<WordTemplateData>) => {
    const confirmed = await confirm({
      title: t('fileList.deleteConfirmTitle'),
      message: t('fileList.deleteConfirmMessage', { filename: template.data.name }),
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeletingIds(prev => new Set([...prev, template.key]));
    try {
      // Get storage assets to find the correct fullPath
      // Juno storage fullPath includes collection prefix: /templates/folder/file.docx
      const storageAssets = await templateStorage.list({});

      // Build possible keys to match against storage
      const possibleKeys = [
        template.key,
        `/${template.key}`,
        template.data.fullPath,
        `/templates/${template.key}`,
        template.data.name,
      ].filter(Boolean);

      // Find matching storage asset
      let storageAsset = null;
      for (const asset of storageAssets) {
        const junoFullPath = asset.fullPath;
        const pathWithoutCollection = junoFullPath.replace(/^\/templates/, '');
        const pathNoLeadingSlash = pathWithoutCollection.startsWith('/')
          ? pathWithoutCollection.substring(1)
          : pathWithoutCollection;
        const filename = junoFullPath.split('/').pop() || '';

        for (const key of possibleKeys) {
          if (key === junoFullPath || key === pathWithoutCollection ||
              key === pathNoLeadingSlash || key === filename) {
            storageAsset = asset;
            break;
          }
        }
        if (storageAsset) break;
      }

      if (storageAsset) {
        try {
          await templateStorage.delete(storageAsset.fullPath);
          console.log(`Deleted asset: ${storageAsset.fullPath}`);
        } catch (assetError: any) {
          console.warn('Failed to delete asset from storage:', assetError);
        }
      } else {
        console.warn('Asset not found in storage for:', template.data.name);
      }

      // Delete metadata from datastore
      await templateRepository.delete(template.key);

      // Remove from recent templates list
      onRemoveFromRecent?.(template.key);

      // Decrement template count in usage statistics
      await decrementTemplateCount();

      // Log successful deletion
      await logActivity({
        action: 'deleted',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: true,
        file_size: template.data.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });

      showSuccessToast(t('fileList.deleteSuccess', { filename: template.data.name }));
      onFileDeleted();
    } catch (error) {
      console.error('Delete failed:', error);
      
      // Log failed deletion
      await logActivity({
        action: 'deleted',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        file_size: template.data.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });
      
      showErrorToast(t('fileList.deleteFailed'));
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  };

  const handleMove = async (targetFolderId: string | null) => {
    if (!templateToMove) return;

    try {
      // Check for duplicate in target folder using cached data
      const isDuplicate = allTemplates.some(doc => {
        const data = doc.data as WordTemplateData;
        return data.name === templateToMove.data.name && (data.folderId ?? null) === targetFolderId;
      });

      if (isDuplicate) {
        showWarningToast(t('fileList.moveFailed') + ': File exists in target folder');
        return;
      }

      // Get target folder info
      const getFolderFromTree = (folderId: string): any => {
        const findInTree = (node: FolderTreeNode): any => {
          if (node.folder.key === folderId) return node.folder;
          for (const child of node.children) {
            const found = findInTree(child);
            if (found) return found;
          }
          return null;
        };

        for (const node of folderTree) {
          const found = findInTree(node);
          if (found) return found;
        }
        return null;
      };

      const targetFolder = targetFolderId ? getFolderFromTree(targetFolderId) : null;
      const newFolderPath = targetFolder?.data.path || '/';

      // Use mutation to update template metadata
      await moveTemplateMutation.mutateAsync({
        template: templateToMove,
        newFolderId: targetFolderId,
      });

      // Log successful move
      await logActivity({
        action: 'moved',
        resource_type: 'template',
        resource_id: templateToMove.key,
        resource_name: templateToMove.data.name,
        created_by: templateToMove.owner || 'unknown',
        modified_by: user?.key || templateToMove.owner || 'unknown',
        success: true,
        old_value: templateToMove.data.folderPath || '/',
        new_value: newFolderPath,
        file_size: templateToMove.data.size,
        folder_path: newFolderPath,
        mime_type: templateToMove.data.mimeType,
      });

      showSuccessToast(t('fileList.moveSuccess'));
      setTemplateToMove(null);
      onFileDeleted(); // Refresh templates

      // Select the destination folder to show its contents
      if (onFolderSelect) {
        onFolderSelect(targetFolderId);
      }
    } catch (error) {
      console.error('Move failed:', error);
      
      // Log failed move
      if (templateToMove) {
        await logActivity({
          action: 'moved',
          resource_type: 'template',
          resource_id: templateToMove.key,
          resource_name: templateToMove.data.name,
          created_by: templateToMove.owner || 'unknown',
          modified_by: user?.key || templateToMove.owner || 'unknown',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          file_size: templateToMove.data.size,
          folder_path: templateToMove.data.folderPath,
          mime_type: templateToMove.data.mimeType,
        });
      }
      
      showErrorToast(t('fileList.moveFailed'));
    }
  };

  // Filter, sort, and paginate templates
  const { paginatedTemplates, totalPages, totalFilteredCount, favoritesCount } = useMemo(() => {
    // Filter by debounced search query for better performance
    let filtered = templates.filter(template =>
      template.data.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );

    // Count favorites before filtering
    const totalFavorites = filtered.filter(t => t.data.isFavorite).length;

    // Filter by favorites if enabled
    if (showFavoritesOnly) {
      filtered = filtered.filter(template => template.data.isFavorite);
    }

    // Sort templates
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.data.name.localeCompare(b.data.name);
          break;
        case 'size':
          comparison = a.data.size - b.data.size;
          break;
        case 'createdOn':
          comparison = a.data.uploadedAt - b.data.uploadedAt;
          break;
        case 'favorite':
          // Favorites first (true = 1, false = 0, so b - a for descending)
          comparison = (b.data.isFavorite ? 1 : 0) - (a.data.isFavorite ? 1 : 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const totalCount = sorted.length;
    const pages = Math.ceil(totalCount / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);

    return {
      paginatedTemplates: paginated,
      totalPages: pages,
      totalFilteredCount: totalCount,
      favoritesCount: totalFavorites
    };
  }, [templates, debouncedSearchQuery, sortField, sortDirection, currentPage, itemsPerPage, showFavoritesOnly]);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // Multi-select handlers
  const handleCheckboxChange = useCallback((template: Doc<WordTemplateData>, checked: boolean) => {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(template.key);
      } else {
        newSet.delete(template.key);
      }
      return newSet;
    });
  }, []);

  const handleRowClick = useCallback((template: Doc<WordTemplateData>, index: number, event: React.MouseEvent) => {
    const isDeleting = deletingIds.has(template.key);
    if (isDeleting) return;

    // Check for modifier keys for multi-select
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + click: Toggle selection
      setSelectedTemplateIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(template.key)) {
          newSet.delete(template.key);
        } else {
          newSet.add(template.key);
        }
        return newSet;
      });
      lastSelectedIndexRef.current = index;
    } else if (event.shiftKey && lastSelectedIndexRef.current !== null) {
      // Shift + click: Range selection
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      setSelectedTemplateIds(prev => {
        const newSet = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (paginatedTemplates[i]) {
            newSet.add(paginatedTemplates[i].key);
          }
        }
        return newSet;
      });
    } else {
      // Normal click: Process single template
      onTemplateSelect(template);
    }
  }, [deletingIds, paginatedTemplates, onTemplateSelect]);

  const handleProcessSelected = useCallback(() => {
    if (selectedTemplateIds.size === 0) return;

    const selectedTemplates = templates.filter(t => selectedTemplateIds.has(t.key));

    if (selectedTemplates.length === 1) {
      // Single selection: use existing flow
      onTemplateSelect(selectedTemplates[0]);
    } else if (onMultiTemplateSelect) {
      // Multiple selection: use multi-template flow
      onMultiTemplateSelect(selectedTemplates);
    }
  }, [selectedTemplateIds, templates, onTemplateSelect, onMultiTemplateSelect]);

  const handleClearSelection = useCallback(() => {
    setSelectedTemplateIds(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedTemplateIds.size === 0) return;

    const selectedTemplates = templates.filter(t => selectedTemplateIds.has(t.key));
    const count = selectedTemplates.length;

    const confirmed = await confirm({
      title: t('fileList.deleteSelectedConfirmTitle'),
      message: t('fileList.deleteSelectedConfirmMessage', { count }),
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    setIsDeletingSelected(true);
    setDeletingIds(prev => new Set([...prev, ...selectedTemplateIds]));

    try {
      // Get all storage assets once
      const storageAssets = await templateStorage.list({});

      let successCount = 0;
      let failCount = 0;

      for (const template of selectedTemplates) {
        try {
          // Build possible keys to match against storage
          const possibleKeys = [
            template.key,
            `/${template.key}`,
            template.data.fullPath,
            `/templates/${template.key}`,
            template.data.name,
          ].filter(Boolean);

          // Find matching storage asset
          let storageAsset = null;
          for (const asset of storageAssets) {
            const junoFullPath = asset.fullPath;
            const pathWithoutCollection = junoFullPath.replace(/^\/templates/, '');
            const pathNoLeadingSlash = pathWithoutCollection.startsWith('/')
              ? pathWithoutCollection.substring(1)
              : pathWithoutCollection;
            const filename = junoFullPath.split('/').pop() || '';

            for (const key of possibleKeys) {
              if (key === junoFullPath || key === pathWithoutCollection ||
                  key === pathNoLeadingSlash || key === filename) {
                storageAsset = asset;
                break;
              }
            }
            if (storageAsset) break;
          }

          if (storageAsset) {
            try {
              await templateStorage.delete(storageAsset.fullPath);
            } catch (assetError: any) {
              console.warn('Failed to delete asset from storage:', assetError);
            }
          }

          // Delete metadata from datastore
          await templateRepository.delete(template.key);

          // Remove from recent templates list
          onRemoveFromRecent?.(template.key);

          // Decrement template count in usage statistics
          await decrementTemplateCount();

          successCount++;
        } catch (error) {
          console.error('Delete failed for:', template.data.name, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        showSuccessToast(t('fileList.deleteSelectedSuccess', { count: successCount }));
      }
      if (failCount > 0) {
        showErrorToast(t('fileList.deleteSelectedFailed', { count: failCount }));
      }

      setSelectedTemplateIds(new Set());
      lastSelectedIndexRef.current = null;
      onFileDeleted();
    } finally {
      setIsDeletingSelected(false);
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        selectedTemplateIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  }, [selectedTemplateIds, templates, confirm, t, onFileDeleted, onRemoveFromRecent]);

  const handleSelectAll = useCallback(() => {
    const allKeys = paginatedTemplates.map(t => t.key);
    setSelectedTemplateIds(new Set(allKeys));
  }, [paginatedTemplates]);

  // Favorite toggle handler
  const handleToggleFavorite = useCallback(async (template: Doc<WordTemplateData>) => {
    setTogglingFavoriteIds(prev => new Set([...prev, template.key]));
    try {
      const newIsFavorite = !template.data.isFavorite;
      await toggleFavoriteMutation.mutateAsync(template);

      // Log successful favorite toggle
      try {
        await logActivity({
          action: 'updated',
          resource_type: 'template',
          resource_id: template.key,
          resource_name: template.data.name,
          created_by: template.owner || 'unknown',
          modified_by: user?.key || template.owner || 'unknown',
          success: true,
          old_value: template.data.isFavorite ? 'favorite' : 'not favorite',
          new_value: newIsFavorite ? 'favorite' : 'not favorite',
          file_size: template.data.size,
          folder_path: template.data.folderPath,
          mime_type: template.data.mimeType
        });
      } catch (logError) {
        console.error('Failed to log favorite toggle:', logError);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showErrorToast(t('fileList.favoriteFailed'));

      // Log failed favorite toggle
      try {
        await logActivity({
          action: 'updated',
          resource_type: 'template',
          resource_id: template.key,
          resource_name: template.data.name,
          created_by: template.owner || 'unknown',
          modified_by: user?.key || template.owner || 'unknown',
          success: false,
          error_message: error instanceof Error ? error.message : 'Toggle favorite failed'
        });
      } catch (logError) {
        console.error('Failed to log favorite toggle failure:', logError);
      }
    } finally {
      setTogglingFavoriteIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  }, [t, user, logActivity, toggleFavoriteMutation]);

  // Duplicate template handler
  // Mobile action menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Virtualization
  const listContainerRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = paginatedTemplates.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: paginatedTemplates.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  // Stable callbacks for FileListItem to prevent re-renders
  const handleItemSelect = useCallback((template: Doc<WordTemplateData>, selected: boolean) => {
    handleCheckboxChange(template, selected);
  }, [handleCheckboxChange]);

  const handleItemRowClick = useCallback((template: Doc<WordTemplateData>, index: number, e: React.MouseEvent) => {
    handleRowClick(template, index, e);
    lastSelectedIndexRef.current = index;
  }, [handleRowClick]);

  const handleItemDuplicate = useCallback((template: Doc<WordTemplateData>) => {
    setTemplateToDuplicate(template);
  }, []);

  const handleItemRename = useCallback((template: Doc<WordTemplateData>) => {
    setTemplateToRename(template);
  }, []);

  const handleItemMove = useCallback((template: Doc<WordTemplateData>) => {
    setTemplateToMove(template);
  }, []);

  const handleDownloadLogs = useCallback(async (template: Doc<WordTemplateData>) => {
    setDownloadingLogsIds(prev => new Set([...prev, template.key]));
    
    try {
      // Fetch logs for this resource
      const logs = await fetchLogsForResource(template.key);
      
      if (logs.length === 0) {
        showWarningToast(t('fileList.noLogsAvailable'));
        return;
      }

      // Generate CSV content
      const csvContent = generateLogCSV(logs, {
        timestamp: t('logs.columns.timestamp'),
        action: t('logs.columns.action'),
        status: t('logs.columns.status'),
        resource: t('logs.columns.resource'),
        details: t('logs.columns.details'),
        createdBy: t('logs.columns.createdBy'),
        modifiedBy: t('logs.columns.modifiedBy'),
        error: t('logs.columns.error'),
      });

      // Download the CSV
      downloadLogCSV(csvContent, template.data.name);
      
      showSuccessToast(t('fileList.downloadLogsSuccess'));
    } catch (error) {
      console.error('Failed to download logs:', error);
      showErrorToast(t('fileList.downloadLogsFailed'));
    } finally {
      setDownloadingLogsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  }, [t]);

  const handlePreview = useCallback(async (template: Doc<WordTemplateData>) => {
    try {
      if (!template.data.url) {
        showErrorToast(t('fileList.previewFailed'));
        return;
      }

      // Fetch the file blob
      const response = await fetchWithTimeout(template.data.url);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      const blob = await response.blob();
      setPreviewBlob(blob);
      setPreviewTemplate(template);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Preview failed:', error);
      showErrorToast(t('fileList.previewFailed'));
    }
  }, [t]);

  const handleMenuToggle = useCallback((templateKey: string | null) => {
    setOpenMenuId(templateKey);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const handleDuplicate = useCallback(async (newName: string) => {
    if (!templateToDuplicate) return;

    setDuplicatingIds(prev => new Set([...prev, templateToDuplicate.key]));
    try {
      // Build the new full path
      const newFullPath = buildTemplatePath(templateToDuplicate.data.folderPath || '/', newName);

      // Create new metadata entry with a new key
      const newKey = `${Date.now()}_${newName}`;
      await createTemplateMutation.mutateAsync({
        key: newKey,
        data: {
          ...templateToDuplicate.data,
          name: newName,
          fullPath: newFullPath,
          uploadedAt: Date.now(),
          isFavorite: false, // Don't copy favorite status
        },
        owner: user?.key || templateToDuplicate.owner || 'unknown',
        created_at: BigInt(Date.now() * 1_000_000),
        updated_at: BigInt(Date.now() * 1_000_000),
        version: 1n,
      } as Doc<WordTemplateData>);

      // Log successful duplicate (treated as created)
      await logActivity({
        action: 'created',
        resource_type: 'template',
        resource_id: newKey,
        resource_name: newName,
        created_by: user?.key || templateToDuplicate.owner || 'unknown',
        modified_by: user?.key || templateToDuplicate.owner || 'unknown',
        success: true,
        file_size: templateToDuplicate.data.size,
        folder_path: templateToDuplicate.data.folderPath,
        mime_type: templateToDuplicate.data.mimeType,
      });

      showSuccessToast(t('fileList.duplicateSuccess', { filename: newName }));
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      
      // Log failed duplicate
      await logActivity({
        action: 'created',
        resource_type: 'template',
        resource_id: templateToDuplicate.key,
        resource_name: newName,
        created_by: user?.key || templateToDuplicate.owner || 'unknown',
        modified_by: user?.key || templateToDuplicate.owner || 'unknown',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        file_size: templateToDuplicate.data.size,
        folder_path: templateToDuplicate.data.folderPath,
        mime_type: templateToDuplicate.data.mimeType,
      });
      
      showErrorToast(t('fileList.duplicateFailed'));
      throw error; // Re-throw to let dialog handle error state
    } finally {
      setDuplicatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateToDuplicate.key);
        return newSet;
      });
    }
  }, [templateToDuplicate, onFileDeleted, t]);

  // Rename template handler
  const handleRename = useCallback(async (newName: string) => {
    if (!templateToRename) return;

    try {
      // Build the new full path
      const newFullPath = buildTemplatePath(templateToRename.data.folderPath || '/', newName);

      // Update template metadata with new name and fullPath
      await updateTemplateMutation.mutateAsync({
        ...templateToRename,
        data: {
          ...templateToRename.data,
          name: newName,
          fullPath: newFullPath,
        }
      });

      // Log successful rename
      await logActivity({
        action: 'renamed',
        resource_type: 'template',
        resource_id: templateToRename.key,
        resource_name: newName,
        created_by: templateToRename.owner || 'unknown',
        modified_by: user?.key || templateToRename.owner || 'unknown',
        success: true,
        old_value: templateToRename.data.name,
        new_value: newName,
        file_size: templateToRename.data.size,
        folder_path: templateToRename.data.folderPath,
        mime_type: templateToRename.data.mimeType,
      });

      showSuccessToast(t('templateRename.renameSuccess', { filename: newName }));
    } catch (error) {
      console.error('Failed to rename template:', error);
      
      // Log failed rename
      await logActivity({
        action: 'renamed',
        resource_type: 'template',
        resource_id: templateToRename.key,
        resource_name: templateToRename.data.name,
        created_by: templateToRename.owner || 'unknown',
        modified_by: user?.key || templateToRename.owner || 'unknown',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        file_size: templateToRename.data.size,
        folder_path: templateToRename.data.folderPath,
        mime_type: templateToRename.data.mimeType,
      });
      
      showErrorToast(t('templateRename.renameFailed'));
      throw error; // Re-throw to let dialog handle error state
    }
  }, [templateToRename, onFileDeleted, t]);

  // Get existing names in the same folder for rename validation
  const existingNamesInFolder = useMemo(() => {
    if (!templateToRename) return [];
    return allTemplates
      .filter(t => t.data.folderId === templateToRename.data.folderId)
      .map(t => t.data.name);
  }, [templateToRename, allTemplates]);

  // Get existing names in the same folder for duplicate validation
  const existingNamesInFolderForDuplicate = useMemo(() => {
    if (!templateToDuplicate) return [];
    return allTemplates
      .filter(t => t.data.folderId === templateToDuplicate.data.folderId)
      .map(t => t.data.name);
  }, [templateToDuplicate, allTemplates]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <ClipboardList className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 text-slate-400 dark:text-slate-600" />
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          {selectedFolderId ? t('fileList.noTemplatesInFolder') : t('fileList.noTemplates')}
        </h3>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          {selectedFolderId ? t('fileList.moveToFolder') : t('fileList.getStarted')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Deleting overlay */}
      {isDeletingSelected && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 animate-spin text-red-600 dark:text-red-400" />
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {t('fileList.deleting')}
            </p>
          </div>
        </div>
      )}

      {/* Search and Controls - Fixed at top */}
      <div className="p-4 space-y-3 shrink-0">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('fileList.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Favorites Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (favoritesCount > 0) {
                setShowFavoritesOnly(!showFavoritesOnly);
                setCurrentPage(1);
              }
            }}
            disabled={favoritesCount === 0}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              favoritesCount === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : showFavoritesOnly
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly && favoritesCount > 0 ? 'fill-current' : ''}`} />
            <span>{t('fileList.favorites')}</span>
            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
              favoritesCount === 0
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                : showFavoritesOnly
                  ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
            }`}>
              {favoritesCount}
            </span>
          </button>
        </div>

        {/* Sort and Items Per Page Controls */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('fileList.sortBy')}:</span>
            <button
              onClick={() => handleSortChange('favorite')}
              className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors h-7.5 ${
                sortField === 'favorite'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <Star className={`w-4 h-4 ${sortField === 'favorite' ? 'fill-current' : ''}`} />
              {sortField === 'favorite' && (sortDirection === 'asc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSortChange('name')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortField === 'name'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {t('fileList.sortByName')} {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSortChange('size')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortField === 'size'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {t('fileList.sortBySize')} {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSortChange('createdOn')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortField === 'createdOn'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {t('fileList.sortByDate')} {sortField === 'createdOn' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          {/* Items Per Page */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('fileList.itemsPerPage')}:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {totalFilteredCount > 0
              ? t('fileList.resultsCount', { count: totalFilteredCount })
              : t('fileList.noResults')
            }
          </div>
        )}

        {/* Selection Action Bar - Always visible to prevent layout shift */}
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-colors ${
          selectedTemplateIds.size > 0
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-center gap-2">
            {/* Select All / Deselect All checkbox */}
            <button
              className="cursor-pointer p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              onClick={() => {
                if (selectedTemplateIds.size === paginatedTemplates.length) {
                  handleClearSelection();
                } else {
                  handleSelectAll();
                }
              }}
              aria-label={selectedTemplateIds.size === paginatedTemplates.length ? t('fileList.clearSelection') : t('fileList.selectAll')}
              aria-pressed={selectedTemplateIds.size === paginatedTemplates.length && paginatedTemplates.length > 0}
            >
              {selectedTemplateIds.size === paginatedTemplates.length && paginatedTemplates.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" />
              )}
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedTemplateIds.size > 0
                ? t('fileList.selectedCount', { count: selectedTemplateIds.size })
                : t('fileList.selectAll')
              }
            </span>
            {selectedTemplateIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
                title={t('fileList.clearSelection')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleProcessSelected}
              disabled={selectedTemplateIds.size === 0}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedTemplateIds.size > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-transparent text-transparent cursor-default'
              }`}
            >
              {t('fileList.processSelected', { count: selectedTemplateIds.size || 1 })}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedTemplateIds.size === 0 || isDeletingSelected}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedTemplateIds.size > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-70 disabled:cursor-not-allowed'
                  : 'bg-transparent text-transparent cursor-default'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {t('fileList.deleteSelected', { count: selectedTemplateIds.size || 1 })}
            </button>
          </div>
        </div>
      </div>

      {/* File List - Scrollable */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto px-4"
        role="region"
        aria-label={t('fileList.title')}
      >
        {totalFilteredCount === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <ClipboardList className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 text-slate-400 dark:text-slate-600" aria-hidden="true" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {t('fileList.noResults')}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              {t('fileList.getStarted')}
            </p>
          </div>
        ) : shouldVirtualize ? (
          /* Virtualized list for many items */
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
            role="list"
            aria-label={t('fileList.title')}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const template = paginatedTemplates[virtualItem.index];
              return (
                <div
                  key={template.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <FileListItem
                    template={template}
                    index={virtualItem.index}
                    isSelected={selectedTemplateIds.has(template.key)}
                    isDeleting={deletingIds.has(template.key)}
                    isDuplicating={duplicatingIds.has(template.key)}
                    isTogglingFavorite={togglingFavoriteIds.has(template.key)}
                    isDownloading={downloadingIds.has(template.key)}
                    isDownloadingLogs={downloadingLogsIds.has(template.key)}
                    isMenuOpen={openMenuId === template.key}
                    onSelect={handleItemSelect}
                    onRowClick={handleItemRowClick}
                    onToggleFavorite={handleToggleFavorite}
                    onDownload={handleDownload}
                    onDuplicate={handleItemDuplicate}
                    onRename={handleItemRename}
                    onMove={handleItemMove}
                    onDelete={handleDelete}
                    onDownloadLogs={handleDownloadLogs}
                    onPreview={handlePreview}
                    onMenuToggle={handleMenuToggle}
                    menuRef={menuRef}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* Non-virtualized list for few items */
          <div className="space-y-1 pb-4" role="list" aria-label={t('fileList.title')}>
            {paginatedTemplates.map((template, index) => (
              <FileListItem
                key={template.key}
                template={template}
                index={index}
                isSelected={selectedTemplateIds.has(template.key)}
                isDeleting={deletingIds.has(template.key)}
                isDuplicating={duplicatingIds.has(template.key)}
                isTogglingFavorite={togglingFavoriteIds.has(template.key)}
                isDownloading={downloadingIds.has(template.key)}
                isDownloadingLogs={downloadingLogsIds.has(template.key)}
                isMenuOpen={openMenuId === template.key}
                onSelect={handleItemSelect}
                onRowClick={handleItemRowClick}
                onToggleFavorite={handleToggleFavorite}
                onDownload={handleDownload}
                onDuplicate={handleItemDuplicate}
                onRename={handleItemRename}
                onMove={handleItemMove}
                onDelete={handleDelete}
                onDownloadLogs={handleDownloadLogs}
                onPreview={handlePreview}
                onMenuToggle={handleMenuToggle}
                menuRef={menuRef}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls - Fixed at bottom */}
      {totalFilteredCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
          {/* Page Info */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {totalPages > 1
              ? t('fileList.pageOf', { current: currentPage, total: totalPages })
              : `${totalFilteredCount} ${totalFilteredCount === 1 ? t('fileList.file') : t('fileList.files')}`
            }
          </div>

          {/* Pagination Buttons */}
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('fileList.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('fileList.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Move Template Dialog */}
      <TemplateMoveDialog
        isOpen={templateToMove !== null}
        template={templateToMove}
        currentFolderId={templateToMove?.data.folderId ?? null}
        folders={folderTree}
        onMove={handleMove}
        onCancel={() => setTemplateToMove(null)}
      />

      {/* Rename Template Dialog */}
      <TemplateRenameDialog
        isOpen={templateToRename !== null}
        template={templateToRename}
        existingNames={existingNamesInFolder}
        onRename={handleRename}
        onCancel={() => setTemplateToRename(null)}
      />

      {/* Duplicate Template Dialog */}
      <TemplateDuplicateDialog
        isOpen={templateToDuplicate !== null}
        template={templateToDuplicate}
        existingNames={existingNamesInFolderForDuplicate}
        onDuplicate={handleDuplicate}
        onCancel={() => setTemplateToDuplicate(null)}
      />

      {/* DOCX Preview Modal */}
      <DocxPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewTemplate(null);
          setPreviewBlob(null);
        }}
        fileName={previewTemplate?.data.name || ''}
        fileBlob={previewBlob}
      />
    </div>
  );
};

export default FileList;
