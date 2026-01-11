import { FC, useState } from 'react';
import { Loader2, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FolderTreeNode } from '../../types/folder';

interface SaveAsDialogProps {
  isOpen: boolean;
  initialFilename: string;
  initialFolderId: string | null;
  folderTree: FolderTreeNode[];
  isLoading: boolean;
  onConfirm: (filename: string, folderId: string | null, newFolderData?: { name: string; parentId: string | null }) => void;
  onClose: () => void;
}

export const SaveAsDialog: FC<SaveAsDialogProps> = ({
  isOpen,
  initialFilename,
  initialFolderId,
  folderTree,
  isLoading,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  // Strip .docx extension for display in input
  const nameWithoutExt = initialFilename.replace(/\.docx$/i, '');

  const [filename, setFilename] = useState(nameWithoutExt);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (showNewFolderForm) {
      // Pass new folder data to parent
      onConfirm(filename, folderId, { name: newFolderName, parentId: newFolderParentId });
    } else {
      onConfirm(filename, folderId);
    }
  };

  const handleClose = () => {
    setShowNewFolderForm(false);
    setNewFolderName('');
    setNewFolderParentId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('templateProcessor.saveAsTitle')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('templateProcessor.saveAsFilename')}
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('templateProcessor.saveAsFilenamePlaceholder')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('templateProcessor.saveAsSelectFolder')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolderForm(!showNewFolderForm);
                  setNewFolderName('');
                  setNewFolderParentId(null);
                }}
                disabled={isLoading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {showNewFolderForm ? t('folders.cancelNewFolder') : t('folders.createNewFolder')}
              </button>
            </div>

            {showNewFolderForm ? (
              <div className="space-y-3 p-3 bg-blue-50 dark:bg-slate-700 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('folders.folderName')}
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('folders.enterFolderName')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('folders.parentFolder')}
                  </label>
                  <select
                    value={newFolderParentId || ''}
                    onChange={(e) => setNewFolderParentId(e.target.value || null)}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('folders.rootFolder')}</option>
                    {folderTree.map((node) => (
                      <option key={node.folder.key} value={node.folder.key}>
                        {node.folder.data.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('folders.rootFolder')}</option>
                {folderTree.map((node) => (
                  <>
                    <option key={node.folder.key} value={node.folder.key}>
                      {node.folder.data.name}
                    </option>
                    {node.children.map((child) => (
                      <option key={child.folder.key} value={child.folder.key}>
                        └─ {child.folder.data.name}
                      </option>
                    ))}
                  </>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!filename.trim() || isLoading}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('templateProcessor.saving')}
              </span>
            ) : (
              t('templateProcessor.saveAs')
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 bg-slate-500 hover:bg-slate-600 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-all"
          >
            {t('templateProcessor.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
