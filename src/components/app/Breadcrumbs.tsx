import { FC } from 'react';
import { ChevronRight, Home, Star, Clock } from 'lucide-react';
import type { Folder } from '../../types/folder';
import { useTranslation } from 'react-i18next';
import { VIRTUAL_FOLDER_FAVORITES, VIRTUAL_FOLDER_RECENT } from '../folders/FolderTree';

interface BreadcrumbsProps {
  selectedFolderId: string | null;
  getFolderById: (folderId: string | null) => Folder | null;
  onSelectFolder: (folderId: string | null) => void;
}

const Breadcrumbs: FC<BreadcrumbsProps> = ({ selectedFolderId, getFolderById, onSelectFolder }) => {
  const { t } = useTranslation();

  // Check if a virtual folder is selected
  const isVirtualFolder = selectedFolderId === VIRTUAL_FOLDER_FAVORITES || selectedFolderId === VIRTUAL_FOLDER_RECENT;

  // Build breadcrumb path
  const buildBreadcrumbPath = (): Folder[] => {
    if (isVirtualFolder) return [];

    const path: Folder[] = [];
    let currentId = selectedFolderId;

    while (currentId) {
      const folder = getFolderById(currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.data.parentId;
    }

    return path;
  };

  const breadcrumbPath = buildBreadcrumbPath();

  // Render virtual folder breadcrumb
  const renderVirtualFolderBreadcrumb = () => {
    if (selectedFolderId === VIRTUAL_FOLDER_FAVORITES) {
      return (
        <>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span className="flex items-center gap-1 px-2 py-1 text-yellow-600 dark:text-yellow-400 font-semibold">
            <Star className="w-4 h-4 fill-current" />
            <span>{t('folders.favorites')}</span>
          </span>
        </>
      );
    }
    if (selectedFolderId === VIRTUAL_FOLDER_RECENT) {
      return (
        <>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span className="flex items-center gap-1 px-2 py-1 text-slate-700 dark:text-slate-300 font-semibold">
            <Clock className="w-4 h-4" />
            <span>{t('folders.recent')}</span>
          </span>
        </>
      );
    }
    return null;
  };

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {/* Root */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
          selectedFolderId === null
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <Home className="w-4 h-4" />
        <span>{t('folders.allTemplates')}</span>
      </button>

      {/* Virtual folder breadcrumb */}
      {isVirtualFolder && renderVirtualFolderBreadcrumb()}

      {/* Folder path */}
      {breadcrumbPath.map((folder, index) => {
        const isLast = index === breadcrumbPath.length - 1;
        return (
          <div key={folder.key} className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <button
              onClick={() => onSelectFolder(folder.key)}
              className={`px-2 py-1 rounded transition-colors ${
                isLast
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {folder.data.name}
            </button>
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
