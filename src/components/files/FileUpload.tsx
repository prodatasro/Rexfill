import { FC, useRef, useState } from 'react';
import { uploadFile, listDocs } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import type { FolderTreeNode } from '../../types/folder';
import { showErrorToast, showWarningToast, showSuccessToast } from '../../utils/toast';
import { buildTemplatePath } from '../../utils/templatePathUtils';
import FolderSelector from '../folders/FolderSelector';
import { useTranslation } from 'react-i18next';

interface FileUploadProps {
  onUploadSuccess: () => void;
  onOneTimeProcess: (file: File) => void;
  selectedFolderId: string | null;
  folderTree: FolderTreeNode[];
}

type UploadMode = 'save' | 'oneTime' | null;

const FileUpload: FC<FileUploadProps> = ({ onUploadSuccess, onOneTimeProcess, selectedFolderId, folderTree }) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(selectedFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkFileExists = async (filename: string, folderId: string | null): Promise<boolean> => {
    try {
      const docs = await listDocs({
        collection: 'templates_meta'
      });

      return docs.items.some(doc => {
        const data = doc.data as WordTemplateData;
        return data.name === filename && (data.folderId ?? null) === folderId;
      });
    } catch (error) {
      console.error('Error checking existing files:', error);
      return false;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    // Store the file and show mode selection dialog
    setSelectedFile(file);
    setUploadFolderId(selectedFolderId); // Initialize with current folder
    setUploadMode('save'); // Show the dialog by setting a non-null value
  };

  const handleModeSelection = async (mode: 'save' | 'saveAndProcess' | 'oneTime') => {
    if (!selectedFile) return;

    if (mode === 'oneTime') {
      // One-time processing - don't save to database
      setUploadMode(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onOneTimeProcess(selectedFile);
      return;
    }

    // Save or Save and Process mode - upload with folder
    setUploading(true);
    try {
      // Check if file with same name already exists in this folder
      const fileExists = await checkFileExists(selectedFile.name, uploadFolderId);
      if (fileExists) {
        showWarningToast(t('fileUpload.fileExists', { filename: selectedFile.name }));
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setUploadMode(null);
        setSelectedFile(null);
        return;
      }

      // Get folder info
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

      const folderData = uploadFolderId ? getFolderFromTree(uploadFolderId) : null;
      const folderPath = folderData?.data.path || '/';
      const fullPath = buildTemplatePath(folderPath, selectedFile.name);

      const templateData: WordTemplateData = {
        name: selectedFile.name,
        size: selectedFile.size,
        uploadedAt: Date.now(),
        mimeType: selectedFile.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        folderId: uploadFolderId,
        folderPath: folderPath,
        fullPath: fullPath
      };

      const result = await uploadFile({
        data: selectedFile,
        collection: 'templates',
        filename: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
      });

      // Store template metadata in datastore
      const { setDoc } = await import('@junobuild/core');
      await setDoc({
        collection: 'templates_meta',
        doc: {
          key: result.name, // Use the uploaded file name as key
          data: {
            ...templateData,
            url: result.downloadUrl
          }
        }
      });

      showSuccessToast(t('fileUpload.uploadSuccess', { filename: selectedFile.name }));

      // Reset state
      setUploadMode(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onUploadSuccess();

      // Open processor only if mode is 'saveAndProcess'
      if (mode === 'saveAndProcess') {
        onOneTimeProcess(selectedFile);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast(t('fileUpload.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  // Helper function to find folder in tree
  const findFolderInTree = (node: FolderTreeNode, folderId: string): boolean => {
    if (node.folder.key === folderId) return true;
    return node.children.some(child => findFolderInTree(child, folderId));
  };

  const handleCancelMode = () => {
    setUploadMode(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={triggerFileSelect}
        disabled={uploading}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
            <span className="text-sm sm:text-base">{t('fileUpload.uploading')}</span>
          </span>
        ) : (
          `📁 ${t('fileUpload.chooseFile')}`
        )}
      </button>

      {/* Upload Mode Selection Dialog */}
      {uploadMode !== null && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              {t('fileUpload.uploadModeTitle')}
            </h3>

            {/* Folder Selector for Save mode */}
            <FolderSelector
              selectedFolderId={uploadFolderId}
              onSelectFolder={setUploadFolderId}
              folders={folderTree}
            />

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleModeSelection('save')}
                disabled={uploading}
                className="w-full text-left p-4 rounded-xl border-2 border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💾</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.saveOnly')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.saveOnlyDesc')}
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelection('saveAndProcess')}
                disabled={uploading}
                className="w-full text-left p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💾⚙️</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.saveAndProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.saveAndProcessDesc')}
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelection('oneTime')}
                disabled={uploading}
                className="w-full text-left p-4 rounded-xl border-2 border-green-300 dark:border-green-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚡</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.oneTimeProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.oneTimeProcessDesc')}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={handleCancelMode}
              disabled={uploading}
              className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('fileUpload.cancelUpload')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUpload;
