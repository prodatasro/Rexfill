import { FC, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { FileText, ClipboardList, Move, Trash2, Search, ChevronLeft, ChevronRight, Download, CheckSquare, Square, X, Loader2, Star, Copy, Pencil, MoreVertical } from 'lucide-react';
import { setDoc, deleteDoc, deleteAsset, listAssets, Doc, listDocs } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import type { FolderTreeNode } from '../../types/folder';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toast';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTranslation } from 'react-i18next';
import TemplateMoveDialog from '../folders/TemplateMoveDialog';
import TemplateRenameDialog from './TemplateRenameDialog';
import TemplateDuplicateDialog from './TemplateDuplicateDialog';
import { buildTemplatePath } from '../../utils/templatePathUtils';
import { useDebounce } from '../../hooks/useDebounce';

type SortField = 'name' | 'size' | 'createdOn' | 'favorite';
type SortDirection = 'asc' | 'desc';

interface FileListProps {
  templates: Doc<WordTemplateData>[];
  allTemplates: Doc<WordTemplateData>[];
  loading: boolean;
  onTemplateSelect: (template: Doc<WordTemplateData>) => void;
  onMultiTemplateSelect?: (templates: Doc<WordTemplateData>[]) => void;
  onFileDeleted: () => void;
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
  onFolderSelect,
  selectedFolderId,
  folderTree
}) => {
  const { t } = useTranslation();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [templateToMove, setTemplateToMove] = useState<Doc<WordTemplateData> | null>(null);
  const [templateToRename, setTemplateToRename] = useState<Doc<WordTemplateData> | null>(null);
  const [templateToDuplicate, setTemplateToDuplicate] = useState<Doc<WordTemplateData> | null>(null);
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
    try {
      if (!template.data.url) {
        showErrorToast(t('fileList.downloadFailed'));
        return;
      }

      // Fetch the file from the URL
      const response = await fetch(template.data.url);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      // Get the blob and create download link
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

      showSuccessToast(t('fileList.downloadSuccess', { filename: template.data.name }));
    } catch (error) {
      console.error('Download failed:', error);
      showErrorToast(t('fileList.downloadFailed'));
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
      const storageAssets = await listAssets({
        collection: 'templates',
        filter: {}
      });

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
      for (const asset of storageAssets.items) {
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
          await deleteAsset({
            collection: 'templates',
            fullPath: storageAsset.fullPath
          });
          console.log(`Deleted asset: ${storageAsset.fullPath}`);
        } catch (assetError: any) {
          console.warn('Failed to delete asset from storage:', assetError);
        }
      } else {
        console.warn('Asset not found in storage for:', template.data.name);
      }

      // Delete metadata from datastore
      await deleteDoc({
        collection: 'templates_meta',
        doc: template
      });

      showSuccessToast(t('fileList.deleteSuccess', { filename: template.data.name }));
      onFileDeleted();
    } catch (error) {
      console.error('Delete failed:', error);
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
      // Check for duplicate in target folder
      const checkDuplicate = async (): Promise<boolean> => {
        const docs = await listDocs({ collection: 'templates_meta' });
        return docs.items.some(doc => {
          const data = doc.data as WordTemplateData;
          return data.name === templateToMove.data.name && (data.folderId ?? null) === targetFolderId;
        });
      };

      const isDuplicate = await checkDuplicate();
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
      const newFullPath = buildTemplatePath(newFolderPath, templateToMove.data.name);

      // Update template metadata
      await setDoc({
        collection: 'templates_meta',
        doc: {
          ...templateToMove,
          data: {
            ...templateToMove.data,
            folderId: targetFolderId,
            folderPath: newFolderPath,
            fullPath: newFullPath
          }
        }
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
      showErrorToast(t('fileList.moveFailed'));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      const storageAssets = await listAssets({
        collection: 'templates',
        filter: {}
      });

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
          for (const asset of storageAssets.items) {
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
              await deleteAsset({
                collection: 'templates',
                fullPath: storageAsset.fullPath
              });
            } catch (assetError: any) {
              console.warn('Failed to delete asset from storage:', assetError);
            }
          }

          // Delete metadata from datastore
          await deleteDoc({
            collection: 'templates_meta',
            doc: template
          });

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
  }, [selectedTemplateIds, templates, confirm, t, onFileDeleted]);

  const handleSelectAll = useCallback(() => {
    const allKeys = paginatedTemplates.map(t => t.key);
    setSelectedTemplateIds(new Set(allKeys));
  }, [paginatedTemplates]);

  // Favorite toggle handler
  const handleToggleFavorite = useCallback(async (template: Doc<WordTemplateData>) => {
    try {
      const newIsFavorite = !template.data.isFavorite;
      await setDoc({
        collection: 'templates_meta',
        doc: {
          ...template,
          data: {
            ...template.data,
            isFavorite: newIsFavorite,
          }
        }
      });
      onFileDeleted(); // Refresh to show updated favorite status
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showErrorToast(t('fileList.favoriteFailed'));
    }
  }, [onFileDeleted, t]);

  // Duplicate template handler
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());

  // Mobile action menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      await setDoc({
        collection: 'templates_meta',
        doc: {
          key: newKey,
          data: {
            ...templateToDuplicate.data,
            name: newName,
            fullPath: newFullPath,
            uploadedAt: Date.now(),
            isFavorite: false, // Don't copy favorite status
          }
        }
      });

      showSuccessToast(t('fileList.duplicateSuccess', { filename: newName }));
      onFileDeleted(); // Refresh the list
    } catch (error) {
      console.error('Failed to duplicate template:', error);
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
      await setDoc({
        collection: 'templates_meta',
        doc: {
          ...templateToRename,
          data: {
            ...templateToRename.data,
            name: newName,
            fullPath: newFullPath,
          }
        }
      });

      showSuccessToast(t('templateRename.renameSuccess', { filename: newName }));
      onFileDeleted(); // Refresh the list
    } catch (error) {
      console.error('Failed to rename template:', error);
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
        {favoritesCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showFavoritesOnly
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
              }`}
            >
              <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              <span>{t('fileList.favorites')}</span>
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                showFavoritesOnly
                  ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              }`}>
                {favoritesCount}
              </span>
            </button>
          </div>
        )}

        {/* Sort and Items Per Page Controls */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('fileList.sortBy')}:</span>
            <button
              onClick={() => handleSortChange('favorite')}
              className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors ${
                sortField === 'favorite'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${sortField === 'favorite' ? 'fill-current' : ''}`} />
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
      <div className="flex-1 overflow-y-auto px-4" role="region" aria-label={t('fileList.title')}>
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
        ) : (
          <div className="space-y-1 pb-4" role="list" aria-label={t('fileList.title')}>
            {paginatedTemplates.map((template, index) => {
              const isDeleting = deletingIds.has(template.key);
              const isSelected = selectedTemplateIds.has(template.key);

              return (
                <div
                  key={template.key}
                  role="listitem"
                  aria-selected={isSelected}
                  className={`flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm transition-all duration-200 ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    className="shrink-0 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckboxChange(template, !isSelected);
                      lastSelectedIndexRef.current = index;
                    }}
                    aria-label={isSelected ? t('fileList.clearSelection') : t('fileList.selectAll')}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" />
                    )}
                  </button>

                  {/* File Icon */}
                  <FileText className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-600" />

                  {/* File Name */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate">
                      <span
                        className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        title={template.data.name}
                        onClick={(e) => handleRowClick(template, index, e)}
                      >
                        {template.data.name}
                      </span>
                    </h3>
                  </div>

                  {/* Placeholder Count Badge */}
                  {template.data.placeholderCount !== undefined && template.data.placeholderCount > 0 && (
                    <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium shrink-0">
                      <span>{template.data.placeholderCount}</span>
                      <span>{template.data.placeholderCount === 1 ? t('fileList.placeholder') : t('fileList.placeholders')}</span>
                    </div>
                  )}

                  {/* Custom Property Count Badge */}
                  {template.data.customPropertyCount !== undefined && template.data.customPropertyCount > 0 && (
                    <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium shrink-0">
                      <span>{template.data.customPropertyCount}</span>
                      <span>{template.data.customPropertyCount === 1 ? t('fileList.customProperty') : t('fileList.customProperties')}</span>
                    </div>
                  )}

                  {/* Metadata - Hidden on mobile, visible on tablet+ */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span>{formatFileSize(template.data.size)}</span>
                    <span>{formatDate(template.data.uploadedAt)}</span>
                  </div>

                  {/* Action Buttons - Desktop */}
                  <div className="hidden sm:flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleFavorite(template)}
                      disabled={isDeleting}
                      className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        template.data.isFavorite
                          ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700'
                          : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-slate-700'
                      }`}
                      title={t('fileList.toggleFavorite')}
                      aria-label={t('fileList.toggleFavorite')}
                    >
                      <Star className={`w-4 h-4 ${template.data.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleDownload(template)}
                      disabled={isDeleting}
                      className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('fileList.downloadTemplate')}
                      aria-label={t('fileList.downloadTemplate')}
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setTemplateToDuplicate(template)}
                      disabled={isDeleting || duplicatingIds.has(template.key)}
                      className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('fileList.duplicateTemplate')}
                      aria-label={t('fileList.duplicateTemplate')}
                    >
                      {duplicatingIds.has(template.key) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setTemplateToRename(template)}
                      disabled={isDeleting}
                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('fileList.renameTemplate')}
                      aria-label={t('fileList.renameTemplate')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setTemplateToMove(template)}
                      disabled={isDeleting}
                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('fileList.moveTemplate')}
                      aria-label={t('fileList.moveTemplate')}
                    >
                      <Move className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(template)}
                      disabled={isDeleting}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('fileList.deleteTemplate')}
                      aria-label={t('fileList.deleteTemplate')}
                    >
                      {isDeleting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Action Buttons - Mobile: Favorite + Dropdown Menu */}
                  <div className="flex sm:hidden gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleFavorite(template)}
                      disabled={isDeleting}
                      className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        template.data.isFavorite
                          ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700'
                          : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-slate-700'
                      }`}
                      title={t('fileList.toggleFavorite')}
                      aria-label={t('fileList.toggleFavorite')}
                    >
                      <Star className={`w-4 h-4 ${template.data.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    {/* More Actions Menu */}
                    <div className="relative" ref={openMenuId === template.key ? menuRef : undefined}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === template.key ? null : template.key)}
                        disabled={isDeleting}
                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('fileList.moreActions')}
                        aria-label={t('fileList.moreActions')}
                        aria-expanded={openMenuId === template.key}
                        aria-haspopup="true"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === template.key && (
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                          <button
                            onClick={() => {
                              handleDownload(template);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Download className="w-4 h-4 text-green-500" />
                            {t('fileList.downloadTemplate')}
                          </button>

                          <button
                            onClick={() => {
                              setTemplateToDuplicate(template);
                              setOpenMenuId(null);
                            }}
                            disabled={duplicatingIds.has(template.key)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                          >
                            <Copy className="w-4 h-4 text-purple-500" />
                            {t('fileList.duplicateTemplate')}
                          </button>

                          <button
                            onClick={() => {
                              setTemplateToRename(template);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Pencil className="w-4 h-4 text-amber-500" />
                            {t('fileList.renameTemplate')}
                          </button>

                          <button
                            onClick={() => {
                              setTemplateToMove(template);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Move className="w-4 h-4 text-blue-500" />
                            {t('fileList.moveTemplate')}
                          </button>

                          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

                          <button
                            onClick={() => {
                              handleDelete(template);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('fileList.deleteTemplate')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
    </div>
  );
};

export default FileList;
