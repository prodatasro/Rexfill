import { FC } from 'react';
import { Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FolderTreeNode } from '../../types/folder';

interface FolderTreeItemSelectableProps {
  node: FolderTreeNode;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (folderId: string) => void;
  onToggleExpand: (folderId: string) => void;
}

const FolderTreeItemSelectable: FC<FolderTreeItemSelectableProps> = ({
  node,
  level,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}) => {
  const { t } = useTranslation();
  const hasChildren = node.children.length > 0;
  const indent = level * 16; // 16px per level

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(node.folder.key);
        break;
      case 'ArrowRight':
        if (hasChildren && !isExpanded) {
          e.preventDefault();
          onToggleExpand(node.folder.key);
        }
        break;
      case 'ArrowLeft':
        if (hasChildren && isExpanded) {
          e.preventDefault();
          onToggleExpand(node.folder.key);
        }
        break;
    }
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all
          ${
            isSelected
              ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-md ring-2 ring-blue-300 dark:ring-blue-400'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }
        `}
        style={{ paddingLeft: `${indent + 12}px` }}
        onClick={() => onSelect(node.folder.key)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.folder.key);
            }}
            className="shrink-0 w-4 h-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label={isExpanded ? t('folders.collapse') : t('folders.expand')}
            tabIndex={-1}
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
            <FolderOpen className={`w-5 h-5 ${isSelected ? 'text-yellow-300' : 'text-yellow-500'}`} />
          ) : (
            <Folder className={`w-5 h-5 ${isSelected ? 'text-yellow-300' : 'text-yellow-500'}`} />
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
              ? 'bg-blue-400 dark:bg-blue-700 text-white'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}>
            {node.templateCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default FolderTreeItemSelectable;
