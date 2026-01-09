import { FC } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { Folder } from '../types/folder';
import { useTranslation } from 'react-i18next';

interface BreadcrumbsProps {
  selectedFolderId: string | null;
  getFolderById: (folderId: string | null) => Folder | null;
  onSelectFolder: (folderId: string | null) => void;
}

const Breadcrumbs: FC<BreadcrumbsProps> = ({ selectedFolderId, getFolderById, onSelectFolder }) => {
  const { t } = useTranslation();

  // Build breadcrumb path
  const buildBreadcrumbPath = (): Folder[] => {
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
