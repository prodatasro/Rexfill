import { FC, useState, useRef, useEffect } from 'react';
import { MoreVertical, FolderPlus, Upload, Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Folder } from '../../types/folder';
import { canCreateSubfolder } from '../../utils/folderUtils';

interface FolderActionsMenuProps {
  folder: Folder;
  onCreateSubfolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onUploadToFolder: () => void;
}

const FolderActionsMenu: FC<FolderActionsMenuProps> = ({
  folder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onUploadToFolder,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canAddSubfolder = canCreateSubfolder(folder);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
        title={t('folders.actions') || 'Folder actions'}
        aria-label={t('folders.actions') || 'Folder actions'}
      >
        <MoreVertical className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
          {canAddSubfolder && (
            <button
              onClick={() => handleAction(onCreateSubfolder)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              {t('folders.createSubfolder')}
            </button>
          )}

          {!canAddSubfolder && (
            <div
              className="w-full px-4 py-2 text-sm text-slate-400 dark:text-slate-600 flex items-center gap-2 cursor-not-allowed"
              title={t('folders.maxDepthReached') || 'Maximum folder depth reached'}
            >
              <FolderPlus className="w-4 h-4" />
              {t('folders.createSubfolder')}
            </div>
          )}

          <button
            onClick={() => handleAction(onUploadToFolder)}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t('folders.uploadToFolder')}
          </button>

          <button
            onClick={() => handleAction(onRename)}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {t('folders.renameFolder')}
          </button>

          <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>

          <button
            onClick={() => handleAction(onDelete)}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('folders.deleteFolder')}
          </button>
        </div>
      )}
    </div>
  );
};

export default FolderActionsMenu;
