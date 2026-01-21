import { memo, FC } from 'react';
import {
  FileText,
  Download,
  Star,
  Copy,
  Pencil,
  Move,
  Trash2,
  CheckSquare,
  Square,
  MoreVertical,
} from 'lucide-react';
import { Doc } from '@junobuild/core';
import { WordTemplateData } from '../../types/word-template';
import { useTranslation } from 'react-i18next';

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export interface FileListItemProps {
  template: Doc<WordTemplateData>;
  index: number;
  isSelected: boolean;
  isDeleting: boolean;
  isDuplicating: boolean;
  isMenuOpen: boolean;
  onSelect: (template: Doc<WordTemplateData>, selected: boolean) => void;
  onRowClick: (template: Doc<WordTemplateData>, index: number, e: React.MouseEvent) => void;
  onToggleFavorite: (template: Doc<WordTemplateData>) => void;
  onDownload: (template: Doc<WordTemplateData>) => void;
  onDuplicate: (template: Doc<WordTemplateData>) => void;
  onRename: (template: Doc<WordTemplateData>) => void;
  onMove: (template: Doc<WordTemplateData>) => void;
  onDelete: (template: Doc<WordTemplateData>) => void;
  onMenuToggle: (templateKey: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Memoized file list item component for better performance
 * Only re-renders when its specific props change
 */
const FileListItem: FC<FileListItemProps> = memo(
  ({
    template,
    index,
    isSelected,
    isDeleting,
    isDuplicating,
    isMenuOpen,
    onSelect,
    onRowClick,
    onToggleFavorite,
    onDownload,
    onDuplicate,
    onRename,
    onMove,
    onDelete,
    onMenuToggle,
    menuRef,
  }) => {
    const { t } = useTranslation();

    return (
      <div
        role="listitem"
        aria-selected={isSelected}
        className={`flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm transition-all duration-200 ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
            : ''
        }`}
      >
        {/* Checkbox */}
        <button
          className="shrink-0 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(template, !isSelected);
          }}
          aria-label={
            isSelected ? t('fileList.clearSelection') : t('fileList.selectAll')
          }
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

        {/* File Name and Path */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate">
            <span
              className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              title={template.data.name}
              onClick={(e) => onRowClick(template, index, e)}
            >
              {template.data.name}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {template.data.folderPath || '/'}
          </p>
        </div>

        {/* Placeholder Count Badge */}
        {template.data.placeholderCount !== undefined &&
          template.data.placeholderCount > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium shrink-0">
              <span>{template.data.placeholderCount}</span>
              <span>
                {template.data.placeholderCount === 1
                  ? t('fileList.placeholder')
                  : t('fileList.placeholders')}
              </span>
            </div>
          )}

        {/* Custom Property Count Badge */}
        {template.data.customPropertyCount !== undefined &&
          template.data.customPropertyCount > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium shrink-0">
              <span>{template.data.customPropertyCount}</span>
              <span>
                {template.data.customPropertyCount === 1
                  ? t('fileList.customProperty')
                  : t('fileList.customProperties')}
              </span>
            </div>
          )}

        {/* Metadata - Hidden on mobile, visible on tablet+ */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>{formatFileSize(template.data.size)}</span>
          <span>{formatDate(template.data.uploadedAt)}</span>
        </div>

        {/* Action Buttons - Desktop */}
        <div
          className="hidden sm:flex gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleFavorite(template)}
            disabled={isDeleting}
            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              template.data.isFavorite
                ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700'
                : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-slate-700'
            }`}
            title={t('fileList.toggleFavorite')}
            aria-label={t('fileList.toggleFavorite')}
          >
            <Star
              className={`w-4 h-4 ${template.data.isFavorite ? 'fill-current' : ''}`}
            />
          </button>

          <button
            onClick={() => onDownload(template)}
            disabled={isDeleting}
            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('fileList.downloadTemplate')}
            aria-label={t('fileList.downloadTemplate')}
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDuplicate(template)}
            disabled={isDeleting || isDuplicating}
            className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('fileList.duplicateTemplate')}
            aria-label={t('fileList.duplicateTemplate')}
          >
            {isDuplicating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => onRename(template)}
            disabled={isDeleting}
            className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('fileList.renameTemplate')}
            aria-label={t('fileList.renameTemplate')}
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => onMove(template)}
            disabled={isDeleting}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('fileList.moveTemplate')}
            aria-label={t('fileList.moveTemplate')}
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(template)}
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
        <div
          className="flex sm:hidden gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleFavorite(template)}
            disabled={isDeleting}
            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              template.data.isFavorite
                ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-700'
                : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-slate-700'
            }`}
            title={t('fileList.toggleFavorite')}
            aria-label={t('fileList.toggleFavorite')}
          >
            <Star
              className={`w-4 h-4 ${template.data.isFavorite ? 'fill-current' : ''}`}
            />
          </button>

          {/* More Actions Menu */}
          <div
            className="relative"
            ref={isMenuOpen ? menuRef : undefined}
          >
            <button
              onClick={() =>
                onMenuToggle(isMenuOpen ? null : template.key)
              }
              disabled={isDeleting}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('fileList.moreActions')}
              aria-label={t('fileList.moreActions')}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                <button
                  onClick={() => {
                    onDownload(template);
                    onMenuToggle(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Download className="w-4 h-4 text-green-500" />
                  {t('fileList.downloadTemplate')}
                </button>

                <button
                  onClick={() => {
                    onDuplicate(template);
                    onMenuToggle(null);
                  }}
                  disabled={isDuplicating}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <Copy className="w-4 h-4 text-purple-500" />
                  {t('fileList.duplicateTemplate')}
                </button>

                <button
                  onClick={() => {
                    onRename(template);
                    onMenuToggle(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Pencil className="w-4 h-4 text-amber-500" />
                  {t('fileList.renameTemplate')}
                </button>

                <button
                  onClick={() => {
                    onMove(template);
                    onMenuToggle(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Move className="w-4 h-4 text-blue-500" />
                  {t('fileList.moveTemplate')}
                </button>

                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

                <button
                  onClick={() => {
                    onDelete(template);
                    onMenuToggle(null);
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
  },
  // Custom comparison function for memo
  (prevProps, nextProps) => {
    return (
      prevProps.template.key === nextProps.template.key &&
      prevProps.template.data.name === nextProps.template.data.name &&
      prevProps.template.data.isFavorite === nextProps.template.data.isFavorite &&
      prevProps.template.data.folderPath === nextProps.template.data.folderPath &&
      prevProps.template.data.placeholderCount === nextProps.template.data.placeholderCount &&
      prevProps.template.data.customPropertyCount === nextProps.template.data.customPropertyCount &&
      prevProps.index === nextProps.index &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDeleting === nextProps.isDeleting &&
      prevProps.isDuplicating === nextProps.isDuplicating &&
      prevProps.isMenuOpen === nextProps.isMenuOpen
    );
  }
);

FileListItem.displayName = 'FileListItem';

export default FileListItem;
