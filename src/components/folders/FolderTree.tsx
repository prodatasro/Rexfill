import { FC, useState, useCallback, useEffect, useMemo } from 'react';
import { Folder as FolderIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FolderTreeNode, Folder } from '../../types/folder';
import FolderTreeItem from './FolderTreeItem';
import LoadingSpinner from '../ui/LoadingSpinner';

interface FolderTreeProps {
  folders: FolderTreeNode[];
  loading: boolean;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onUploadToFolder: (folderId: string) => void;
  totalTemplateCount?: number;
  searchQuery?: string;
  expandAllTrigger?: number; // Increment to trigger expand all
  collapseAllTrigger?: number; // Increment to trigger collapse all
  sortOrder?: 'asc' | 'desc'; // Sort order for first-level folders
}

const STORAGE_KEY = 'rexfill_folder_expansion_state';

const FolderTree: FC<FolderTreeProps> = ({
  folders,
  loading,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onUploadToFolder,
  totalTemplateCount = 0,
  searchQuery = '',
  expandAllTrigger,
  collapseAllTrigger,
  sortOrder = 'asc',
}) => {
  const { t } = useTranslation();

  // Load initial state from localStorage
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load folder expansion state:', error);
    }
    return new Set();
  });

  // Save to localStorage whenever expandedFolderIds changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedFolderIds)));
    } catch (error) {
      console.error('Failed to save folder expansion state:', error);
    }
  }, [expandedFolderIds]);

  // Auto-expand folders that have children ONLY when searching
  useEffect(() => {
    // Only auto-expand if there's an active search query (2+ chars)
    if (searchQuery.length >= 2) {
      const foldersWithChildren = new Set<string>();

      const collectFoldersWithChildren = (nodes: FolderTreeNode[]) => {
        nodes.forEach(node => {
          if (node.children.length > 0) {
            foldersWithChildren.add(node.folder.key);
            collectFoldersWithChildren(node.children);
          }
        });
      };

      collectFoldersWithChildren(folders);
      setExpandedFolderIds(foldersWithChildren);
    }
    // Note: When search is cleared, we don't reset - we keep the user's expansion state
  }, [folders, searchQuery]);

  // Auto-expand parent folders when a child folder is selected
  useEffect(() => {
    if (!selectedFolderId) return;

    // Find the parent of the selected folder
    const findParentId = (nodes: FolderTreeNode[], targetId: string): string | null => {
      for (const node of nodes) {
        // Check if target is a direct child
        if (node.children.some(child => child.folder.key === targetId)) {
          return node.folder.key;
        }
        // Recursively search in children
        const parentId = findParentId(node.children, targetId);
        if (parentId) return parentId;
      }
      return null;
    };

    const parentId = findParentId(folders, selectedFolderId);

    // If we found a parent, ensure it's expanded
    if (parentId) {
      setExpandedFolderIds(prev => {
        if (!prev.has(parentId)) {
          const newSet = new Set(prev);
          newSet.add(parentId);
          return newSet;
        }
        return prev;
      });
    }
  }, [selectedFolderId, folders]);

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allFolderIds = new Set<string>();
    const collectAllFolderIds = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allFolderIds.add(node.folder.key);
          collectAllFolderIds(node.children);
        }
      });
    };
    collectAllFolderIds(folders);
    setExpandedFolderIds(allFolderIds);
  }, [folders]);

  const collapseAll = useCallback(() => {
    setExpandedFolderIds(new Set());
  }, []);

  // Respond to expandAll trigger
  useEffect(() => {
    if (expandAllTrigger !== undefined && expandAllTrigger > 0) {
      expandAll();
    }
  }, [expandAllTrigger, expandAll]);

  // Respond to collapseAll trigger
  useEffect(() => {
    if (collapseAllTrigger !== undefined && collapseAllTrigger > 0) {
      collapseAll();
    }
  }, [collapseAllTrigger, collapseAll]);

  // Sort first-level folders by name
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      const nameA = a.folder.data.name.toLowerCase();
      const nameB = b.folder.data.name.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [folders, sortOrder]);

  const renderFolderItem = (node: FolderTreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedFolderIds.has(node.folder.key);

    return (
      <div key={node.folder.key}>
        <FolderTreeItem
          node={node}
          level={level}
          isSelected={selectedFolderId === node.folder.key}
          isExpanded={isExpanded}
          onSelect={() => onSelectFolder(node.folder.key)}
          onToggleExpand={() => toggleExpand(node.folder.key)}
          onCreateSubfolder={() => onCreateFolder(node.folder.key)}
          onRename={() => onRenameFolder(node.folder)}
          onDelete={() => onDeleteFolder(node.folder)}
          onUploadToFolder={() => onUploadToFolder(node.folder.key)}
        />
        {/* Render children recursively */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderFolderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-2">
      {/* All Templates (Root) */}
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 border-l-4
          ${
            selectedFolderId === null
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border-l-blue-500 dark:border-l-blue-400 font-semibold'
              : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10 text-slate-700 dark:text-slate-300 hover:shadow-sm border-l-transparent'
          }
        `}
        onClick={() => onSelectFolder(null)}
      >
        <FolderIcon className={`w-5 h-5 shrink-0 ${selectedFolderId === null ? 'text-yellow-600' : 'text-yellow-500'}`} />
        <span className="flex-1 font-medium text-sm">
          Root
        </span>
        {/* Template count */}
        {totalTemplateCount > 0 && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
            selectedFolderId === null
              ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}>
            {totalTemplateCount}
          </span>
        )}
      </div>

      {/* Divider */}
      {folders.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
      )}

      {/* Folder tree */}
      {sortedFolders.length > 0 ? (
        <div className="space-y-1">
          {sortedFolders.map((node) => renderFolderItem(node, 0))}
        </div>
      ) : (
        <div className="text-center py-8 px-4">
          <FolderIcon className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {t('folders.noFolders')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            {t('folders.createFirst')}
          </p>
        </div>
      )}
    </div>
  );
};

export default FolderTree;
