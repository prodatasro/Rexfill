import { FC, memo } from 'react';
import { X, FolderPlus, Search, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Download, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Folder, FolderTreeNode } from '../../types/folder';
import FileUpload from '../files/FileUpload';
import FolderTree from '../folders/FolderTree';
import LogDownloadMenu from './LogDownloadMenu';

interface DashboardSidebarProps {
  // Sidebar visibility
  isOpen: boolean;
  onClose: () => void;

  // Folder data
  folderTree: FolderTreeNode[];
  filteredFolderTree: FolderTreeNode[];
  foldersLoading: boolean;

  // Selection
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;

  // Folder operations
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDeleteFolderFiles: (folder: Folder) => void;
  onUploadToFolder: (folderId: string) => void;

  // Search
  folderSearchQuery: string;
  onFolderSearchChange: (query: string) => void;

  // Expand/Collapse
  expandAllTrigger: number;
  collapseAllTrigger: number;
  foldersExpanded: boolean;
  onToggleFoldersExpanded: () => void;

  // Sort
  folderSortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;

  // Export/Import
  onOpenExportDialog: () => void;
  onOpenImportDialog: () => void;

  // Download Logs
  onDownloadAllLogs: () => void;
  onDownloadOneTimeLogs: () => void;
  isDownloadingLogs: boolean;

  // Counts
  totalTemplateCount: number;
  favoritesCount: number;
  recentCount: number;

  // File upload callbacks
  onUploadSuccess: (folderId: string | null | undefined) => void;
  onOneTimeProcess: (file: File) => void;
  onSaveAndProcess: (templateKey: string) => void;
}

const DashboardSidebar: FC<DashboardSidebarProps> = memo(({
  isOpen,
  onClose,
  folderTree,
  filteredFolderTree,
  foldersLoading,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteFolderFiles,
  onUploadToFolder,
  folderSearchQuery,
  onFolderSearchChange,
  expandAllTrigger,
  collapseAllTrigger,
  foldersExpanded,
  onToggleFoldersExpanded,
  folderSortOrder,
  onToggleSortOrder,
  onOpenExportDialog,
  onOpenImportDialog,
  onDownloadAllLogs,
  onDownloadOneTimeLogs,
  isDownloadingLogs,
  totalTemplateCount,
  favoritesCount,
  recentCount,
  onUploadSuccess,
  onOneTimeProcess,
  onSaveAndProcess,
}) => {
  const { t } = useTranslation();

  const handleSelectFolder = (folderId: string | null) => {
    onSelectFolder(folderId);
    onClose(); // Close sidebar on mobile after selection
  };

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-40 w-90 shrink-0
        bg-white dark:bg-slate-900 lg:bg-transparent
        border-r border-slate-200 dark:border-slate-700 lg:border-0
        transform transition-transform duration-300 ease-in-out
        lg:h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="h-full flex flex-col p-4 lg:p-0">
        {/* Close button for mobile */}
        <div className="lg:hidden flex justify-between items-center mb-4 shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-slate-50">Folders</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50 text-sm">{t('folders.title')}</h3>
                <div className="flex gap-1">
                  <FileUpload
                    onUploadSuccess={onUploadSuccess}
                    onOneTimeProcess={onOneTimeProcess}
                    onSaveAndProcess={onSaveAndProcess}
                    selectedFolderId={selectedFolderId}
                    folderTree={folderTree}
                    compact={true}
                  />
                  <button
                    onClick={() => onCreateFolder(selectedFolderId)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    title={t('folders.newFolder')}
                    aria-label={t('folders.newFolder')}
                  >
                    <FolderPlus className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  </button>
                </div>
              </div>
              {/* Folder search input */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={folderSearchQuery}
                  onChange={(e) => onFolderSearchChange(e.target.value)}
                  placeholder={t('folders.searchPlaceholder')}
                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                {folderSearchQuery && (
                  <button
                    onClick={() => onFolderSearchChange('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </button>
                )}
              </div>
              {/* Expand/Collapse/Sort/Export/Import buttons */}
              <div className="flex gap-1 mt-2 justify-center">
                <button
                  onClick={onToggleFoldersExpanded}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title={foldersExpanded ? t('folders.collapseAll') : t('folders.expandAll')}
                  aria-label={foldersExpanded ? t('folders.collapseAll') : t('folders.expandAll')}
                >
                  {foldersExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                <button
                  onClick={onToggleSortOrder}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title={folderSortOrder === 'asc' ? t('folders.sortAZ') : t('folders.sortZA')}
                  aria-label={folderSortOrder === 'asc' ? t('folders.sortAZ') : t('folders.sortZA')}
                >
                  {folderSortOrder === 'asc' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                </button>
                <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" />
                <button
                  onClick={onOpenExportDialog}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title={t('exportImport.exportTitle')}
                  aria-label={t('exportImport.exportTitle')}
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={onOpenImportDialog}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title={t('exportImport.importTitle')}
                  aria-label={t('exportImport.importTitle')}
                >
                  <Archive className="w-5 h-5" />
                </button>
                <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" />
                <LogDownloadMenu
                  onDownloadAllLogs={onDownloadAllLogs}
                  onDownloadOneTimeLogs={onDownloadOneTimeLogs}
                  isDownloading={isDownloadingLogs}
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <FolderTree
                folders={filteredFolderTree}
                loading={foldersLoading}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                onCreateFolder={onCreateFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onDeleteFolderFiles={onDeleteFolderFiles}
                onUploadToFolder={onUploadToFolder}
                totalTemplateCount={totalTemplateCount}
                favoritesCount={favoritesCount}
                recentCount={recentCount}
                searchQuery={folderSearchQuery}
                expandAllTrigger={expandAllTrigger}
                collapseAllTrigger={collapseAllTrigger}
                sortOrder={folderSortOrder}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});

DashboardSidebar.displayName = 'DashboardSidebar';

export default DashboardSidebar;
