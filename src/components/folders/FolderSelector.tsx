import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { FolderTreeNode } from '../../types/folder';

interface FolderSelectorProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: FolderTreeNode[];
}

const FolderSelector: FC<FolderSelectorProps> = ({
  selectedFolderId,
  onSelectFolder,
  folders,
}) => {
  const { t } = useTranslation();

  // Flatten folder tree for dropdown
  const flattenFolders = (nodes: FolderTreeNode[], level: number = 0): Array<{ id: string | null; name: string; level: number }> => {
    const result: Array<{ id: string | null; name: string; level: number }> = [];

    nodes.forEach((node) => {
      result.push({
        id: node.folder.key,
        name: node.folder.data.name,
        level,
      });

      if (node.children.length > 0) {
        result.push(...flattenFolders(node.children, level + 1));
      }
    });

    return result;
  };

  const flatFolders = flattenFolders(folders);

  return (
    <div className="mb-4">
      <label
        htmlFor="folderSelect"
        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
      >
        {t('fileUpload.selectFolder')}
      </label>
      <select
        id="folderSelect"
        value={selectedFolderId || ''}
        onChange={(e) => onSelectFolder(e.target.value || null)}
        className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
      >
        <option value="">
          📁 {t('fileUpload.rootFolder')}
        </option>
        {flatFolders.map((folder) => (
          <option key={folder.id} value={folder.id || ''}>
            {'  '.repeat(folder.level)}📂 {folder.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FolderSelector;
