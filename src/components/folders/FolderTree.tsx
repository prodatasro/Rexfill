import { FC, useState, useCallback } from 'react';
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
      {folders.length > 0 ? (
        <div className="space-y-1">
          {folders.map((node) => renderFolderItem(node, 0))}
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
