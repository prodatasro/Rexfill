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

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors
          ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }
        `}
        style={{ paddingLeft: `${indent + 12}px` }}
        onClick={onSelect}
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
          {isExpanded ? <FolderOpen className="w-5 h-5 text-yellow-500" /> : <Folder className="w-5 h-5 text-yellow-500" />}
        </span>

        {/* Folder name */}
        <span className="flex-1 truncate font-medium text-sm">
          {node.folder.data.name}
        </span>

        {/* Template count */}
        {node.templateCount > 0 && (
          <span className="shrink-0 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
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
