import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../../types/word-template';
import type { FolderTreeNode } from '../../types/folder';
import FolderSelector from '../folders/FolderSelector';

interface TemplateMoveDialogProps {
  isOpen: boolean;
  template: Doc<WordTemplateData> | null;
  currentFolderId: string | null;
  folders: FolderTreeNode[];
  onMove: (targetFolderId: string | null) => Promise<void>;
  onCancel: () => void;
}

const TemplateMoveDialog: FC<TemplateMoveDialogProps> = ({
  isOpen,
  template,
  currentFolderId,
  folders,
  onMove,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [targetFolderId, setTargetFolderId] = useState<string | null>(currentFolderId);
  const [isMoving, setIsMoving] = useState(false);

  const handleMove = async () => {
    if (!template) return;

    setIsMoving(true);
    try {
      await onMove(targetFolderId);
      onCancel();
    } catch (error) {
      console.error('Error moving template:', error);
    } finally {
      setIsMoving(false);
    }
  };

  if (!isOpen || !template) return null;

  // Get current folder name
  const getCurrentFolderName = () => {
    if (!currentFolderId) return t('fileUpload.rootFolder');

    const findFolder = (nodes: FolderTreeNode[]): string | null => {
      for (const node of nodes) {
        if (node.folder.key === currentFolderId) {
          return node.folder.data.name;
        }
        if (node.children.length > 0) {
          const found = findFolder(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findFolder(folders) || t('fileUpload.rootFolder');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('templateMove.title')}
        </h3>

        <div className="mb-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            <span className="font-semibold text-slate-900 dark:text-slate-50">
              {template.data.name}
            </span>
          </p>

          <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            <span className="font-medium">{t('templateMove.currentLocation')}:</span>{' '}
            <span className="font-semibold">{getCurrentFolderName()}</span>
          </div>

          <FolderSelector
            selectedFolderId={targetFolderId}
            onSelectFolder={setTargetFolderId}
            folders={folders}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isMoving}
            className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('confirmDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={isMoving || targetFolderId === currentFolderId}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
          >
            {isMoving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                {t('templateMove.moving')}
              </span>
            ) : (
              t('templateMove.moveButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateMoveDialog;
