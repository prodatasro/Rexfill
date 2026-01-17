import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, X, Folder, FileText, Check } from 'lucide-react';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../types/word_template';
import type { Folder as FolderType, FolderTreeNode } from '../types/folder';
import {
  createExportZip,
  downloadBlob,
  generateExportFilename,
  formatFileSize,
} from '../utils/exportImport';
import { showSuccessToast, showErrorToast } from '../utils/toast';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Doc<WordTemplateData>[];
  folders: FolderType[];
  folderTree: FolderTreeNode[];
  fetchTemplateBlob: (template: Doc<WordTemplateData>) => Promise<Blob | null>;
}

const ExportDialog: FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  templates,
  folders,
  folderTree,
  fetchTemplateBlob,
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [includeAllTemplates, setIncludeAllTemplates] = useState(true);

  // Calculate totals based on selection
  const { selectedTemplates, selectedFolders, totalSize } = useMemo(() => {
    let templatesToExport: Doc<WordTemplateData>[];
    let foldersToExport: FolderType[];

    if (includeAllTemplates) {
      templatesToExport = templates;
      foldersToExport = folders;
    } else if (selectedFolderIds.size === 0) {
      // No folders selected - export root templates only
      templatesToExport = templates.filter((t) => !t.data.folderId);
      foldersToExport = [];
    } else {
      // Get selected folders and their subfolders
      const allSelectedFolderIds = new Set<string>();

      const addFolderAndChildren = (folderId: string) => {
        allSelectedFolderIds.add(folderId);
        const children = folders.filter((f) => f.data.parentId === folderId);
        children.forEach((child) => addFolderAndChildren(child.key));
      };

      selectedFolderIds.forEach(addFolderAndChildren);

      foldersToExport = folders.filter((f) => allSelectedFolderIds.has(f.key));
      templatesToExport = templates.filter(
        (t) => t.data.folderId && allSelectedFolderIds.has(t.data.folderId)
      );
    }

    const size = templatesToExport.reduce((sum, t) => sum + (t.data.size || 0), 0);

    return {
      selectedTemplates: templatesToExport,
      selectedFolders: foldersToExport,
      totalSize: size,
    };
  }, [templates, folders, selectedFolderIds, includeAllTemplates]);

  const handleFolderToggle = (folderId: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedTemplates.length === 0 && selectedFolders.length === 0) {
      showErrorToast(t('exportImport.noSelection'));
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Create wrapper that tracks progress
      let processedCount = 0;
      const totalCount = selectedTemplates.length;

      const progressFetcher = async (template: Doc<WordTemplateData>) => {
        const blob = await fetchTemplateBlob(template);
        processedCount++;
        setExportProgress(Math.round((processedCount / totalCount) * 100));
        return blob;
      };

      const zipBlob = await createExportZip(
        selectedTemplates,
        selectedFolders,
        progressFetcher
      );

      const filename = generateExportFilename();
      downloadBlob(zipBlob, filename);

      showSuccessToast(
        t('exportImport.exportSuccess', {
          templates: selectedTemplates.length,
          folders: selectedFolders.length,
        })
      );
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      showErrorToast(t('exportImport.exportFailed'));
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const renderFolderTree = (nodes: FolderTreeNode[], level: number = 0) => {
    return nodes.map((node) => {
      const isSelected = selectedFolderIds.has(node.folder.key);
      const templatesInFolder = templates.filter(
        (t) => t.data.folderId === node.folder.key
      ).length;

      return (
        <div key={node.folder.key}>
          <label
            className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${
              isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleFolderToggle(node.folder.key)}
              disabled={includeAllTemplates || isExporting}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
              {node.folder.data.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {templatesInFolder} {templatesInFolder === 1 ? t('fileList.file') : t('fileList.files')}
            </span>
          </label>
          {node.children.length > 0 && renderFolderTree(node.children, level + 1)}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('exportImport.exportTitle')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('exportImport.exportDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Export all option */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900">
            <input
              type="checkbox"
              checked={includeAllTemplates}
              onChange={(e) => setIncludeAllTemplates(e.target.checked)}
              disabled={isExporting}
              className="w-5 h-5 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <div className="flex-1">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {t('exportImport.exportAll')}
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('exportImport.exportAllDesc', {
                  templates: templates.length,
                  folders: folders.length,
                })}
              </p>
            </div>
            {includeAllTemplates && (
              <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </label>

          {/* Folder selection */}
          {!includeAllTemplates && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('exportImport.selectFolders')}
              </h4>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto">
                {folderTree.length > 0 ? (
                  <div className="py-2">{renderFolderTree(folderTree)}</div>
                ) : (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                    {t('folders.noFolders')}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('exportImport.selectFoldersHint')}
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('exportImport.exportSummary')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedTemplates.length} {t('exportImport.templates')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedFolders.length} {t('exportImport.folders')}
                </span>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('exportImport.estimatedSize')}: {formatFileSize(totalSize)}
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {t('exportImport.exporting')}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {exportProgress}%
                </span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {t('confirmDialog.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || (selectedTemplates.length === 0 && selectedFolders.length === 0)}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('exportImport.exporting')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t('exportImport.exportButton')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
