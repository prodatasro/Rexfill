import { FC } from 'react';
import { Folder, FolderOpen, ChevronRight } from 'lucide-react';
import type { FolderTreeNode } from '../../types/folder';
import FolderActionsMenu from './FolderActionsMenu';

interface FolderTreeItemProps {
  node: FolderTreeNode;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onCreateSubfolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onUploadToFolder: () => void;
}

const FolderTreeItem: FC<FolderTreeItemProps> = ({
  node,
  level,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onCreateSubfolder,
  onRename,
  onDelete,
  onUploadToFolder,
}) => {
  const hasChildren = node.children.length > 0;
  const indent = level * 16; // 16px per level

  // Handle double-click to expand/collapse first-level folders
  const handleDoubleClick = () => {
    if (level === 0 && hasChildren) {
      onToggleExpand();
    }
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4
          ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border-l-blue-500 dark:border-l-blue-400 font-semibold'
              : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10 text-slate-700 dark:text-slate-300 hover:shadow-sm border-l-transparent'
          }
        `}
        style={{ paddingLeft: `${indent + 12}px` }}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="shrink-0 w-4 h-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        {/* Placeholder for alignment if no children */}
        {!hasChildren && <div className="w-4 h-4 shrink-0"></div>}

        {/* Folder icon */}
        <span className="shrink-0">
          {isExpanded ? (
            <FolderOpen className={`w-5 h-5 ${isSelected ? 'text-yellow-600' : 'text-yellow-500'}`} />
          ) : (
            <Folder className={`w-5 h-5 ${isSelected ? 'text-yellow-600' : 'text-yellow-500'}`} />
          )}
        </span>

        {/* Folder name */}
        <span className="flex-1 truncate font-medium text-sm">
          {node.folder.data.name}
        </span>

        {/* Template count */}
        {node.templateCount > 0 && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
            isSelected
              ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}>
            {node.templateCount}
          </span>
        )}

        {/* Actions menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <FolderActionsMenu
            folder={node.folder}
            onCreateSubfolder={onCreateSubfolder}
            onRename={onRename}
            onDelete={onDelete}
            onUploadToFolder={onUploadToFolder}
          />
        </div>
      </div>

    </div>
  );
};

export default FolderTreeItem;
