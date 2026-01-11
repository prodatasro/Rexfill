import { FC, useState, useMemo } from 'react';
import { FileText, ClipboardList, Move, Trash2, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { setDoc, deleteDoc, deleteAsset, Doc, listDocs } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import type { FolderTreeNode } from '../../types/folder';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toast';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTranslation } from 'react-i18next';
import TemplateMoveDialog from '../folders/TemplateMoveDialog';
import { buildTemplatePath } from '../../utils/templatePathUtils';

type SortField = 'name' | 'size' | 'createdOn';
type SortDirection = 'asc' | 'desc';

interface FileListProps {
  templates: Doc<WordTemplateData>[];
  allTemplates: Doc<WordTemplateData>[];
  loading: boolean;
  onTemplateSelect: (template: Doc<WordTemplateData>) => void;
  onFileDeleted: () => void;
  onFolderSelect?: (folderId: string | null) => void;
  selectedFolderId: string | null;
  folderTree: FolderTreeNode[];
}

const FileList: FC<FileListProps> = ({
  templates,
  loading,
  onTemplateSelect,
  onFileDeleted,
  onFolderSelect,
  selectedFolderId,
  folderTree
}) => {
  const { t } = useTranslation();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [movingId, setMovingId] = useState<string | null>(null);
  const [templateToMove, setTemplateToMove] = useState<Doc<WordTemplateData> | null>(null);
  const { confirm } = useConfirm();

  // Search, sort, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
      // Delete from storage using fullPath if available
      const fullPath = template.data.fullPath || `/${template.data.name}`;
      try {
        await deleteAsset({
          collection: 'templates',
          fullPath: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
        });
      } catch (assetError: any) {
        // If asset not found, log warning but continue to delete metadata
        if (assetError?.message?.includes('asset_not_found')) {
          console.warn('Asset not found in storage, continuing to delete metadata:', fullPath);
        } else {
          // For other errors, rethrow
          throw assetError;
        }
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

    setMovingId(templateToMove.key);
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
    } finally {
      setMovingId(null);
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
  const { paginatedTemplates, totalPages, totalFilteredCount } = useMemo(() => {
    // Filter by search query
    let filtered = templates.filter(template =>
      template.data.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
      totalFilteredCount: totalCount
    };
  }, [templates, searchQuery, sortField, sortDirection, currentPage, itemsPerPage]);

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
    <div className="h-full flex flex-col">
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

        {/* Sort and Items Per Page Controls */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('fileList.sortBy')}:</span>
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
      </div>

      {/* File List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4">
        {totalFilteredCount === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <ClipboardList className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 text-slate-400 dark:text-slate-600" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {t('fileList.noResults')}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              {t('fileList.getStarted')}
            </p>
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            {paginatedTemplates.map((template) => {
              const isDeleting = deletingIds.has(template.key);

              return (
                <div
                  key={template.key}
                  className="flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm transition-all duration-200 cursor-pointer"
                  onClick={() => !isDeleting && onTemplateSelect(template)}
                >
                  {/* File Icon */}
                  <FileText className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-600" />

                  {/* File Name */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate" title={template.data.name}>
                      {template.data.name}
                    </h3>
                  </div>

                  {/* Metadata - Hidden on mobile, visible on tablet+ */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span>{formatFileSize(template.data.size)}</span>
                    <span>{formatDate(template.data.uploadedAt)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
};

export default FileList;
