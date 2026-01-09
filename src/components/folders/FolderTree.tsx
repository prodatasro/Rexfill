import { FC, useState, useCallback } from 'react';
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
}

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
}) => {
  const { t } = useTranslation();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* All Templates (Root) */}
        <div
          className={`
            flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors mb-2
            ${
              selectedFolderId === null
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }
          `}
          onClick={() => onSelectFolder(null)}
        >
          <span className="text-lg">📁</span>
          <span className="flex-1 font-medium text-sm">
            {t('folders.allTemplates')}
          </span>
          {/* Template count */}
          {totalTemplateCount > 0 && (
            <span className="flex-shrink-0 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {totalTemplateCount}
            </span>
          )}
        </div>

        {/* Divider */}
        {folders.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        )}

        {/* Folder tree */}
        {folders.length > 0 ? (
          <div className="space-y-1">
            {folders.map((node) => renderFolderItem(node, 0))}
          </div>
        ) : (
          <div className="text-center py-8 px-4">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t('folders.noFolders')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {t('folders.createFirst')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderTree;
