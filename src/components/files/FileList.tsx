import { FC, useState } from 'react';
import { setDoc, deleteDoc, deleteAsset, Doc, listDocs } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import type { FolderTreeNode } from '../../types/folder';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toast';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTranslation } from 'react-i18next';
import TemplateMoveDialog from '../folders/TemplateMoveDialog';
import { buildTemplatePath } from '../../utils/templatePathUtils';

interface FileListProps {
  templates: Doc<WordTemplateData>[];
  allTemplates: Doc<WordTemplateData>[];
  loading: boolean;
  onTemplateSelect: (template: Doc<WordTemplateData>) => void;
  onFileDeleted: () => void;
  selectedFolderId: string | null;
  folderTree: FolderTreeNode[];
}

const FileList: FC<FileListProps> = ({
  templates,
  allTemplates,
  loading,
  onTemplateSelect,
  onFileDeleted,
  selectedFolderId,
  folderTree
}) => {
  const { t } = useTranslation();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [templateToMove, setTemplateToMove] = useState<Doc<WordTemplateData> | null>(null);
  const { confirm } = useConfirm();

  const handleDelete = async (template: Doc<WordTemplateData>) => {
    const confirmed = await confirm({
      title: t('fileList.deleteConfirmTitle'),
      message: t('fileList.deleteConfirmMessage', { filename: template.data.name }),
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeletingIds(prev => new Set([...prev, template.key]));
    try {
      // Delete from storage using fullPath if available
      const fullPath = template.data.fullPath || `/${template.data.name}`;
      try {
        await deleteAsset({
          collection: 'templates',
          fullPath: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
        });
      } catch (assetError: any) {
        // If asset not found, log warning but continue to delete metadata
        if (assetError?.message?.includes('asset_not_found')) {
          console.warn('Asset not found in storage, continuing to delete metadata:', fullPath);
        } else {
          // For other errors, rethrow
          throw assetError;
        }
      }

      // Delete metadata from datastore
      await deleteDoc({
        collection: 'templates_meta',
        doc: template
      });

      showSuccessToast(t('fileList.deleteSuccess', { filename: template.data.name }));
      onFileDeleted();
    } catch (error) {
      console.error('Delete failed:', error);
      showErrorToast(t('fileList.deleteFailed'));
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  };

  const handleMove = async (targetFolderId: string | null) => {
    if (!templateToMove) return;

    try {
      // Check for duplicate in target folder
      const checkDuplicate = async (): Promise<boolean> => {
        const docs = await listDocs({ collection: 'templates_meta' });
        return docs.items.some(doc => {
          const data = doc.data as WordTemplateData;
          return data.name === templateToMove.data.name && (data.folderId ?? null) === targetFolderId;
        });
      };

      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        showWarningToast(t('fileList.moveFailed') + ': File exists in target folder');
        return;
      }

      // Get target folder info
      const getFolderFromTree = (folderId: string): any => {
        const findInTree = (node: FolderTreeNode): any => {
          if (node.folder.key === folderId) return node.folder;
          for (const child of node.children) {
            const found = findInTree(child);
            if (found) return found;
          }
          return null;
        };

        for (const node of folderTree) {
          const found = findInTree(node);
          if (found) return found;
        }
        return null;
      };

      const targetFolder = targetFolderId ? getFolderFromTree(targetFolderId) : null;
      const newFolderPath = targetFolder?.data.path || '/';
      const newFullPath = buildTemplatePath(newFolderPath, templateToMove.data.name);

      // Update template metadata
      await setDoc({
        collection: 'templates_meta',
        doc: {
          ...templateToMove,
          data: {
            ...templateToMove.data,
            folderId: targetFolderId,
            folderPath: newFolderPath,
            fullPath: newFullPath
          }
        }
      });

      showSuccessToast(t('fileList.moveSuccess'));
      setTemplateToMove(null);
      onFileDeleted(); // Refresh templates
    } catch (error) {
      console.error('Move failed:', error);
      showErrorToast(t('fileList.moveFailed'));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📋</div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          {selectedFolderId ? t('fileList.noTemplatesInFolder') : t('fileList.noTemplates')}
        </h3>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          {selectedFolderId ? t('fileList.moveToFolder') : t('fileList.getStarted')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => {
          const isDeleting = deletingIds.has(template.key);

          return (
            <div
              key={template.key}
              className="card p-4 sm:p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="text-3xl sm:text-4xl">📄</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTemplateToMove(template)}
                    disabled={isDeleting}
                    className="text-blue-500 hover:text-blue-700 disabled:text-slate-400 transition-colors p-1"
                    title={t('fileList.moveTemplate')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    disabled={isDeleting}
                    className="text-red-500 hover:text-red-700 disabled:text-slate-400 transition-colors p-1"
                    title={t('fileList.deleteTemplate')}
                  >
                    {isDeleting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-50 mb-2 truncate" title={template.data.name}>
                {template.data.name}
              </h3>

              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-3 sm:mb-4">
                <p>{t('fileList.size')}: {formatFileSize(template.data.size)}</p>
                <p>{t('fileList.uploaded')}: {formatDate(template.data.uploadedAt)}</p>
              </div>

              <button
                onClick={() => onTemplateSelect(template)}
                disabled={isDeleting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed text-sm sm:text-base"
              >
                ✨ {t('fileList.processTemplate')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Move Template Dialog */}
      <TemplateMoveDialog
        isOpen={templateToMove !== null}
        template={templateToMove}
        currentFolderId={templateToMove?.data.folderId ?? null}
        folders={folderTree}
        onMove={handleMove}
        onCancel={() => setTemplateToMove(null)}
      />
    </>
  );
};

export default FileList;
