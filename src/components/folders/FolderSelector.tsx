import { FC, useState, useCallback, useEffect, useMemo } from 'react';
import { Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FolderTreeNode } from '../../types/folder';
import FolderTreeItemSelectable from './FolderTreeItemSelectable';

interface FolderSelectorProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: FolderTreeNode[];
}

const FolderSelector: FC<FolderSelectorProps> = ({
  selectedFolderId,
  onSelectFolder,
  folders,
}) => {
  const { t } = useTranslation();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Find parent of selected folder and expand it by default
  const findParentId = useCallback((folderId: string, nodes: FolderTreeNode[]): string | null => {
    for (const node of nodes) {
      if (node.children.some(child => child.folder.key === folderId)) {
        return node.folder.key;
      }
      const parentInChildren = findParentId(folderId, node.children);
      if (parentInChildren) return parentInChildren;
    }
    return null;
  }, []);

  // Smart default: expand parent of selected folder
  useEffect(() => {
    if (selectedFolderId) {
      const parentId = findParentId(selectedFolderId, folders);
      if (parentId) {
        setExpandedFolderIds(new Set([parentId]));
      }
    }
  }, [selectedFolderId, folders, findParentId]);

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

  const renderFolderItem = useCallback((node: FolderTreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedFolderIds.has(node.folder.key);

    return (
      <div key={node.folder.key}>
        <FolderTreeItemSelectable
          node={node}
          level={level}
          isSelected={selectedFolderId === node.folder.key}
          isExpanded={isExpanded}
          onSelect={onSelectFolder}
          onToggleExpand={toggleExpand}
        />
        {/* Render children recursively */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderFolderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedFolderIds, selectedFolderId, onSelectFolder, toggleExpand]);

  // Calculate total template count
  const totalTemplateCount = useMemo(() => {
    const countTemplates = (nodes: FolderTreeNode[]): number => {
      return nodes.reduce((sum, node) => {
        return sum + node.templateCount + countTemplates(node.children);
      }, 0);
    };
    return countTemplates(folders);
  }, [folders]);

  const handleRootKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectFolder(null);
    }
  };

  return (
    <div className="mb-4">
      <label
        htmlFor="folderSelect"
        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
      >
        <Folder className="w-5 h-5 inline-block mr-1 text-yellow-500" />
        {t('fileUpload.selectFolder')}
      </label>
      <div
        id="folderSelect"
        className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 max-h-64 overflow-y-auto p-2 transition-colors"
        role="tree"
      >
        {/* Root folder option */}
        <div
          className={`
            flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all mb-2
            ${
              selectedFolderId === null
                ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-md ring-2 ring-blue-300 dark:ring-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }
          `}
          onClick={() => onSelectFolder(null)}
          onKeyDown={handleRootKeyDown}
          tabIndex={0}
          role="treeitem"
          aria-selected={selectedFolderId === null}
        >
          <Folder className={`w-5 h-5 shrink-0 ${selectedFolderId === null ? 'text-yellow-300' : 'text-yellow-500'}`} />
          <span className="flex-1 font-medium text-sm">
            {t('fileUpload.rootFolder')}
          </span>
          {totalTemplateCount > 0 && (
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
              selectedFolderId === null
                ? 'bg-blue-400 dark:bg-blue-700 text-white'
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
          <div className="text-center py-4 px-4">
            <Folder className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('folders.noFolders')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderSelector;
