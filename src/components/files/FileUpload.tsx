import { FC, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Save, Settings, Zap, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { WordTemplateData } from '../../types/word-template';
import type { FolderTreeNode } from '../../types/folder';
import { showErrorToast, showWarningToast, showSuccessToast } from '../../utils/toast';
import { buildTemplatePath } from '../../utils/templatePathUtils';
import { extractMetadataFromFile } from '../../utils/extractMetadata';
import FolderSelector from '../folders/FolderSelector';
import { useTranslation } from 'react-i18next';
import { templateKeys } from '../../hooks/useTemplatesQuery';
import { uploadFileWithTimeout, setDocWithTimeout, deleteAssetWithTimeout } from '../../utils/junoWithTimeout';
import { TimeoutError } from '../../utils/fetchWithTimeout';
import { logActivity } from '../../utils/activityLogger';
import { useAuth, useSubscription } from '../../contexts';

interface FileUploadProps {
  onUploadSuccess: (uploadedToFolderId?: string | null) => void;
  onOneTimeProcess: (file: File) => void;
  onSaveAndProcess: (templateKey: string) => void;
  selectedFolderId: string | null;
  folderTree: FolderTreeNode[];
  compact?: boolean;
}

type UploadMode = 'save' | 'oneTime' | null;

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max
const WARNING_FILE_SIZE = 25 * 1024 * 1024; // 25MB warning threshold

interface UploadProgress {
  currentFile: number;
  totalFiles: number;
  currentFileName: string;
  status: 'preparing' | 'uploading' | 'saving';
}

const FileUpload: FC<FileUploadProps> = ({ onUploadSuccess, onOneTimeProcess, onSaveAndProcess, selectedFolderId, folderTree, compact = false }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canUploadTemplate, incrementTemplateCount, showUpgradePrompt, plan, usage } = useSubscription();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(selectedFolderId);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkFileExists = async (filename: string, folderId: string | null): Promise<boolean> => {
    try {
      // Use cached data from TanStack Query
      const cachedTemplates = queryClient.getQueryData<any[]>(templateKeys.lists()) || [];
      
      return cachedTemplates.some(doc => {
        const data = doc.data as WordTemplateData;
        return data.name === filename && (data.folderId ?? null) === folderId;
      });
    } catch (error) {
      console.error('Error checking existing files:', error);
      return false;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Filter only .docx files
    let validFiles = files.filter(file => file.name.endsWith('.docx'));

    if (validFiles.length === 0) {
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    if (validFiles.length < files.length) {
      showWarningToast(t('fileUpload.someFilesInvalid'));
    }

    // Check file sizes
    const oversizedFiles = validFiles.filter(file => file.size > MAX_FILE_SIZE);
    const largeFiles = validFiles.filter(file => file.size > WARNING_FILE_SIZE && file.size <= MAX_FILE_SIZE);

    // Remove oversized files
    if (oversizedFiles.length > 0) {
      oversizedFiles.forEach(file => {
        showErrorToast(t('fileUpload.fileTooLarge', {
          filename: file.name,
          maxSize: Math.round(MAX_FILE_SIZE / (1024 * 1024))
        }));
      });
      validFiles = validFiles.filter(file => file.size <= MAX_FILE_SIZE);
    }

    // Warn about large (but acceptable) files
    if (largeFiles.length > 0) {
      largeFiles.forEach(file => {
        showWarningToast(t('fileUpload.fileLargeWarning', {
          filename: file.name,
          size: Math.round(file.size / (1024 * 1024))
        }));
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    // Store the files and show mode selection dialog
    setSelectedFiles(validFiles);
    setUploadFolderId(selectedFolderId); // Initialize with current folder
    setUploadMode('save'); // Show the dialog by setting a non-null value
  };

  const handleModeSelection = async (mode: 'save' | 'saveAndProcess' | 'oneTime') => {
    if (selectedFiles.length === 0) return;

    if (mode === 'oneTime') {
      // One-time processing - don't save to database
      // Only single file allowed (button is disabled for multiple files)
      setUploadMode(null);
      const fileToProcess = selectedFiles[0];
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onOneTimeProcess(fileToProcess);
      return;
    }

    // Save or Save and Process mode - upload with folder
    
    // Check subscription limits before uploading
    const isUnlimited = plan.limits.maxTemplates === -1;
    const availableSlots = isUnlimited ? Infinity : plan.limits.maxTemplates - usage.totalTemplates;
    
    if (!isUnlimited && selectedFiles.length > availableSlots) {
      showErrorToast(
        t('subscription.templateLimitExceeded', { 
          available: availableSlots,
          requested: selectedFiles.length 
        }) || `You can upload ${availableSlots} more template(s). You're trying to upload ${selectedFiles.length}.`
      );
      showUpgradePrompt();
      setUploadMode(null);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!canUploadTemplate()) {
      showErrorToast(t('subscription.templateLimitReached'));
      showUpgradePrompt();
      setUploadMode(null);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failedFiles: string[] = [];
    let savedTemplateKey: string | null = null;

    try {
      // Get folder info once
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

      // Process each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Update progress - preparing
        setUploadProgress({
          currentFile: i + 1,
          totalFiles: selectedFiles.length,
          currentFileName: file.name,
          status: 'preparing'
        });

        try {
          // Check if file with same name already exists in this folder
          const fileExists = await checkFileExists(file.name, uploadFolderId);
          if (fileExists) {
            showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
            failedFiles.push(file.name);
            continue;
          }

          const fullPath = buildTemplatePath(folderPath, file.name);

          // Extract custom properties from the file
          const { customPropertyCount } = await extractMetadataFromFile(file);

          const templateData: WordTemplateData = {
            name: file.name,
            size: file.size,
            uploadedAt: Date.now(),
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: uploadFolderId,
            folderPath: folderPath,
            fullPath: fullPath,
            customPropertyCount
          };

          // Update progress - uploading
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: selectedFiles.length,
            currentFileName: file.name,
            status: 'uploading'
          });

          const result = await uploadFileWithTimeout({
            data: file,
            collection: 'templates',
            filename: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
          });

          // Save fullPath for potential rollback
          const uploadedAssetPath = result.fullPath;

          // Update progress - saving metadata
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: selectedFiles.length,
            currentFileName: file.name,
            status: 'saving'
          });

          try {
            // Store template metadata in datastore
            await setDocWithTimeout({
              collection: 'templates_meta',
              doc: {
                key: result.name, // Use the uploaded file name as key
                data: {
                  ...templateData,
                  url: result.downloadUrl
                }
              }
            });

            // Invalidate cache to refetch templates
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });

            // Track the template key for saveAndProcess mode
            savedTemplateKey = result.name;
            successCount++;

            // Increment template count (fire-and-forget)
            incrementTemplateCount();
          } catch (metadataError) {
            // Rollback: Delete from storage
            console.error(`Metadata save failed for ${file.name}, rolling back:`, metadataError);
            try {
              await deleteAssetWithTimeout({
                collection: 'templates',
                fullPath: uploadedAssetPath
              });
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
            showErrorToast(t('fileUpload.uploadRolledBack', { filename: file.name }));
            throw metadataError;
          }

          // Log successful upload
          try {
            await logActivity({
              action: 'created',
              resource_type: 'template',
              resource_id: result.name,
              resource_name: file.name,
              created_by: user?.key || 'unknown',
              modified_by: user?.key || 'unknown',
              success: true,
              file_size: file.size,
              folder_path: folderPath,
              mime_type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
          } catch (logError) {
            console.error('Failed to log upload activity:', logError);
          }
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          failedFiles.push(file.name);

          // Log failed upload
          try {
            await logActivity({
              action: 'created',
              resource_type: 'template',
              resource_id: 'unknown',
              resource_name: file.name,
              created_by: user?.key || 'unknown',
              modified_by: user?.key || 'unknown',
              success: false,
              error_message: error instanceof Error ? error.message : 'Upload failed'
            });
          } catch (logError) {
            console.error('Failed to log upload failure:', logError);
          }
        }
      }

      // Show appropriate success/error messages
      if (successCount > 0) {
        if (successCount === 1) {
          showSuccessToast(t('fileUpload.uploadSuccess', { filename: selectedFiles[0].name }));
        } else {
          showSuccessToast(t('fileUpload.uploadMultipleSuccess', { count: successCount }));
        }
      }

      if (failedFiles.length > 0) {
        showErrorToast(t('fileUpload.uploadMultipleFailed', { count: failedFiles.length }));
      }

      // Reset state
      setUploadMode(null);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Pass the folder ID to onUploadSuccess so Dashboard can navigate to it
      onUploadSuccess(uploadFolderId);

      // Open processor if mode is 'saveAndProcess' (only single file allowed)
      if (mode === 'saveAndProcess' && savedTemplateKey) {
        onSaveAndProcess(savedTemplateKey);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (error instanceof TimeoutError) {
        showErrorToast(t('errors.timeout'));
      } else {
        showErrorToast(t('fileUpload.uploadFailed'));
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Helper function to find folder in tree
  const findFolderInTree = (node: FolderTreeNode, folderId: string): boolean => {
    if (node.folder.key === folderId) return true;
    return node.children.some(child => findFolderInTree(child, folderId));
  };

  const handleCancelMode = () => {
    setUploadMode(null);
    setSelectedFiles([]);
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
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {compact ? (
        <button
          onClick={triggerFileSelect}
          disabled={uploading}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('fileUpload.chooseFile')}
          aria-label={t('fileUpload.chooseFile')}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-700 dark:text-slate-300" />
          ) : (
            <Upload className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          )}
        </button>
      ) : (
        <button
          onClick={triggerFileSelect}
          disabled={uploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('fileUpload.uploading')}
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              {t('fileUpload.chooseFile')}
            </>
          )}
        </button>
      )}

      {/* Upload Mode Selection Dialog */}
      {uploadMode !== null && selectedFiles.length > 0 && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 sm:p-8 relative">
            {/* Upload in progress overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-600 dark:text-purple-400" />
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {t('fileUpload.uploading')}
                  </p>

                  {/* Progress details */}
                  {uploadProgress && (
                    <div className="w-full space-y-2">
                      {/* Progress bar */}
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.currentFile / uploadProgress.totalFiles) * 100}%` }}
                        />
                      </div>

                      {/* File counter */}
                      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>
                          {t('fileUpload.uploadProgress', {
                            current: uploadProgress.currentFile,
                            total: uploadProgress.totalFiles
                          })}
                        </span>
                        <span>
                          {uploadProgress.status === 'preparing' && t('fileUpload.statusPreparing')}
                          {uploadProgress.status === 'uploading' && t('fileUpload.statusUploading')}
                          {uploadProgress.status === 'saving' && t('fileUpload.statusSaving')}
                        </span>
                      </div>

                      {/* Current file name */}
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate text-center">
                        {uploadProgress.currentFileName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              {t('fileUpload.uploadModeTitle')}
            </h3>

            {/* Show selected files */}
            {selectedFiles.length > 0 && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('fileUpload.selectedFiles', { count: selectedFiles.length })}
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      • {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <Save className="w-6 h-6 text-purple-600 dark:text-purple-400 shrink-0" />
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
                disabled={uploading || selectedFiles.length > 1}
                className="w-full text-left p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 shrink-0">
                    <Save className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.saveAndProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.saveAndProcessDesc')}
                    </div>
                    {selectedFiles.length > 1 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {t('fileUpload.singleFileOnly')}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelection('oneTime')}
                disabled={uploading || selectedFiles.length > 1}
                className="w-full text-left p-4 rounded-xl border-2 border-green-300 dark:border-green-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <Zap className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.oneTimeProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.oneTimeProcessDesc')}
                    </div>
                    {selectedFiles.length > 1 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {t('fileUpload.singleFileOnly')}
                      </div>
                    )}
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
        </div>,
        document.body
      )}
    </>
  );
};

export default FileUpload;
