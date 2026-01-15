import { FC, useState, useMemo } from 'react';
import { Loader2, FolderPlus, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FolderTreeNode } from '../../types/folder';

type ModifierType = 'prefix' | 'suffix';

interface FilePreview {
  original: string;
  modified: string;
}

interface MultiSaveAsDialogProps {
  isOpen: boolean;
  fileNames: string[];
  initialFolderId: string | null;
  folderTree: FolderTreeNode[];
  isLoading: boolean;
  onConfirm: (
    modifierType: ModifierType,
    modifierValue: string,
    folderId: string | null,
    newFolderData?: { name: string; parentId: string | null }
  ) => void;
  onClose: () => void;
}

export const MultiSaveAsDialog: FC<MultiSaveAsDialogProps> = ({
  isOpen,
  fileNames,
  initialFolderId,
  folderTree,
  isLoading,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  const [modifierType, setModifierType] = useState<ModifierType>('suffix');
  const [modifierValue, setModifierValue] = useState('');
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Generate preview of modified filenames
  const filePreviews: FilePreview[] = useMemo(() => {
    return fileNames.map(fileName => {
      const nameWithoutExt = fileName.replace(/\.docx$/i, '');
      let modified: string;

      if (modifierType === 'prefix') {
        modified = `${modifierValue}${nameWithoutExt}.docx`;
      } else {
        modified = `${nameWithoutExt}${modifierValue}.docx`;
      }

      return {
        original: fileName,
        modified,
      };
    });
  }, [fileNames, modifierType, modifierValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (showNewFolderForm) {
      onConfirm(modifierType, modifierValue, folderId, { name: newFolderName, parentId: newFolderParentId });
    } else {
      onConfirm(modifierType, modifierValue, folderId);
    }
  };

  const handleClose = () => {
    setShowNewFolderForm(false);
    setNewFolderName('');
    setNewFolderParentId(null);
    setModifierValue('');
    setModifierType('suffix');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 dark:text-purple-400" />
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {t('templateProcessor.saving')}
              </p>
            </div>
          </div>
        )}

        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          {t('templateProcessor.multiSaveAsTitle', { count: fileNames.length })}
        </h3>

        <div className="space-y-4">
          {/* Modifier Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('templateProcessor.multiSaveAsModifierType')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModifierType('prefix')}
                disabled={isLoading}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  modifierType === 'prefix'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {t('templateProcessor.multiSaveAsPrefix')}
              </button>
              <button
                type="button"
                onClick={() => setModifierType('suffix')}
                disabled={isLoading}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  modifierType === 'suffix'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {t('templateProcessor.multiSaveAsSuffix')}
              </button>
            </div>
          </div>

          {/* Modifier Value Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {modifierType === 'prefix'
                ? t('templateProcessor.multiSaveAsPrefixValue')
                : t('templateProcessor.multiSaveAsSuffixValue')}
            </label>
            <input
              type="text"
              value={modifierValue}
              onChange={(e) => setModifierValue(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={modifierType === 'prefix'
                ? t('templateProcessor.multiSaveAsPrefixPlaceholder')
                : t('templateProcessor.multiSaveAsSuffixPlaceholder')}
            />
          </div>

          {/* Preview Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('templateProcessor.multiSaveAsPreview')}
            </label>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
              {filePreviews.map((preview, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {preview.original}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">→</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium truncate">
                    {preview.modified}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Folder Selection */}
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
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={isLoading}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={!modifierValue.trim() || isLoading}
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
