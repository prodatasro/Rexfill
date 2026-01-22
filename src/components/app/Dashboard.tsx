import { FC, useState, useCallback, useRef, useMemo, useEffect, DragEvent, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Folder as FolderIcon } from 'lucide-react';
import { Doc } from '@junobuild/core';
import { WordTemplateData } from '../../types/word-template';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { setDocWithTimeout, uploadFileWithTimeout, listDocsWithTimeout } from '../../utils/junoWithTimeout';
import type { Folder } from '../../types/folder';
import FileList from '../files/FileList';
import { VIRTUAL_FOLDER_FAVORITES, VIRTUAL_FOLDER_RECENT } from '../folders/FolderTree';
import FolderDialog from '../dialogs/FolderDialog';
import Breadcrumbs from './Breadcrumbs';
import ExportDialog from '../dialogs/ExportDialog';
import ImportDialog from '../dialogs/ImportDialog';
import Sidebar from './Sidebar';
import DropModeDialog from '../dialogs/DropModeDialog';
import {
  UploadProgressOverlay,
  DeletingOverlay,
  DragDropOverlay,
  type UploadProgress,
} from '../overlays';
import { useFolders } from '../../hooks/useFolders';
import { useTemplatesByFolder } from '../../hooks/useTemplatesByFolder';
import { useRecentTemplates } from '../../hooks/useRecentTemplates';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useFileProcessing } from '../../contexts/FileProcessingContext';
import { useSearch } from '../../contexts/SearchContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { updateTemplatePathAfterRename, buildTemplatePath } from '../../utils/templatePathUtils';
import { getAllSubfolderIds, buildStorageAssetMap, deleteTemplates } from '../../utils/templateDeletion';
import { extractMetadataFromFile } from '../../utils/extractMetadata';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';

const Dashboard: FC = () => {
  const { t } = useTranslation();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setOneTimeFile } = useFileProcessing();
  const { setAllTemplates, setFolderTree, setOnSelectTemplate, setOnSelectFolder } = useSearch();

  // Initialize selectedFolderId from URL params BEFORE any hook calls
  const folderIdFromParams = searchParams.get('folder');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderIdFromParams);

  // Clean up URL params after reading them
  useEffect(() => {
    if (folderIdFromParams) {
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount
  const [folderDialogState, setFolderDialogState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    parentFolder?: Folder;
    existingFolder?: Folder;
  }>({ isOpen: false, mode: 'create' });

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Upload to folder state
  const [uploadToFolderId, setUploadToFolderId] = useState<string | null>(null);
  const [isFolderUploading, setIsFolderUploading] = useState(false);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  // Folder deletion state (includes asset deletion)
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);
  const [showDropModeDialog, setShowDropModeDialog] = useState(false);
  const dragCounterRef = useRef(0);

  // Folder search state
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const debouncedFolderSearchQuery = useDebounce(folderSearchQuery, 300);

  // Folder expansion triggers
  const [expandAllTrigger, setExpandAllTrigger] = useState(0);
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0);
  const [foldersExpanded, setFoldersExpanded] = useState(true);

  // Folder sort state
  const [folderSortOrder, setFolderSortOrder] = useState<'asc' | 'desc'>('asc');

  // Export/Import dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Determine the actual folder ID to use for filtering (ignore virtual folders for the hook)
  const actualFolderId = useMemo(() => {
    if (selectedFolderId === VIRTUAL_FOLDER_FAVORITES || selectedFolderId === VIRTUAL_FOLDER_RECENT) {
      return null; // Virtual folders don't map to real folder IDs
    }
    return selectedFolderId;
  }, [selectedFolderId]);

  // Load templates by folder
  const { templates: folderTemplates, allTemplates, loading: templatesLoading, refresh: refreshTemplates } = useTemplatesByFolder(actualFolderId);

  // Load folders
  const { folders, folderTree, loading: foldersLoading, loadFolders, createFolder, renameFolder, deleteFolder, getFolderById } = useFolders(allTemplates);

  // Recent templates
  const { recentTemplates, addRecentTemplate, removeRecentTemplate } = useRecentTemplates();

  // Get actual template objects for recent templates
  const recentTemplateObjects = useMemo(() => {
    return recentTemplates
      .map(recent => allTemplates.find(t => t.key === recent.id))
      .filter((t): t is Doc<WordTemplateData> => t !== undefined);
  }, [recentTemplates, allTemplates]);

  // Get all favorite templates
  const favoriteTemplates = useMemo(() => {
    return allTemplates.filter(t => t.data.isFavorite);
  }, [allTemplates]);

  // Compute displayed templates based on selected folder (including virtual folders)
  const templates = useMemo(() => {
    if (selectedFolderId === VIRTUAL_FOLDER_FAVORITES) {
      return favoriteTemplates;
    }
    if (selectedFolderId === VIRTUAL_FOLDER_RECENT) {
      return recentTemplateObjects;
    }
    return folderTemplates;
  }, [selectedFolderId, favoriteTemplates, recentTemplateObjects, folderTemplates]);

  // Filter folder tree based on debounced search query
  const filteredFolderTree = useMemo(() => {
    // Only filter if search query has at least 2 characters
    if (debouncedFolderSearchQuery.length < 2) {
      return folderTree;
    }

    const query = debouncedFolderSearchQuery.toLowerCase();

    // Helper function to filter tree while preserving parent-child relationships
    const filterTree = (nodes: typeof folderTree): typeof folderTree => {
      return nodes.reduce((acc, node) => {
        const currentMatches = node.folder.data.name.toLowerCase().includes(query);
        const filteredChildren = filterTree(node.children);

        // Include node if it matches OR if it has matching children
        if (currentMatches || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren
          });
        }

        return acc;
      }, [] as typeof folderTree);
    };

    return filterTree(folderTree);
  }, [folderTree, debouncedFolderSearchQuery]);

  // Fetch template blob for export
  const fetchTemplateBlob = useCallback(async (template: Doc<WordTemplateData>): Promise<Blob | null> => {
    if (!template.data.url) return null;
    try {
      const response = await fetchWithTimeout(template.data.url);
      return await response.blob();
    } catch (error) {
      console.error(`Failed to fetch template ${template.data.name}:`, error);
      return null;
    }
  }, []);

  // Handle template selection for processing
  const handleTemplateSelect = useCallback((template: Doc<WordTemplateData>) => {
    // Add to recent templates
    addRecentTemplate(template.key, template.data.name);
    // Navigate to processor page with template ID
    navigate(`/app/process?id=${template.key}`);
  }, [navigate, addRecentTemplate]);

  // Sync data with search context for global search
  useEffect(() => {
    setAllTemplates(allTemplates);
  }, [allTemplates, setAllTemplates]);

  useEffect(() => {
    setFolderTree(folderTree);
  }, [folderTree, setFolderTree]);

  useEffect(() => {
    setOnSelectTemplate(handleTemplateSelect);
    setOnSelectFolder(setSelectedFolderId);

    return () => {
      setOnSelectTemplate(null);
      setOnSelectFolder(null);
    };
  }, [handleTemplateSelect, setOnSelectTemplate, setOnSelectFolder]);

  const handleOneTimeProcess = (file: File) => {
    // Store file in context and navigate to processor
    setOneTimeFile(file);
    navigate('/app/process');
  };

  const handleSaveAndProcess = (templateKey: string) => {
    // Navigate to processor page with template ID (for Save & Process mode)
    navigate(`/app/process?id=${templateKey}`);
  };

  const handleMultiTemplateSelect = (templates: Doc<WordTemplateData>[]) => {
    // Navigate to processor page with multiple template IDs
    const ids = templates.map(t => t.key).join(',');
    navigate(`/app/process?ids=${ids}`);
  };

  // Folder operations
  const handleCreateFolder = useCallback((parentId: string | null) => {
    const parentFolder = parentId ? getFolderById(parentId) : null;
    setFolderDialogState({
      isOpen: true,
      mode: 'create',
      parentFolder: parentFolder || undefined,
    });
  }, [getFolderById]);

  const handleRenameFolder = useCallback((folder: Folder) => {
    setFolderDialogState({
      isOpen: true,
      mode: 'rename',
      existingFolder: folder,
    });
  }, []);

  const handleDeleteFolder = useCallback(async (folder: Folder) => {
    // Get all folder IDs to delete (folder + all subfolders)
    const folderIdsToDelete = new Set(getAllSubfolderIds(folder.key, folderTree));

    // Count templates in this folder and all subfolders
    const templatesInFolders = allTemplates.filter(t =>
      t.data.folderId && folderIdsToDelete.has(t.data.folderId)
    );

    // Confirm deletion
    const confirmed = await confirm({
      title: t('folders.deleteFolderConfirm', { name: folder.data.name }),
      message: `${t('folders.deleteFolderDetail', { count: templatesInFolders.length })}\n\n${t('folders.cannotUndo')}`,
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    // Show loading spinner
    setIsDeletingFolder(true);

    try {
      // Build storage asset map and delete all templates
      const storageAssetMap = await buildStorageAssetMap();
      await deleteTemplates(templatesInFolders, storageAssetMap);

      // Remove deleted templates from recent list
      templatesInFolders.forEach(t => removeRecentTemplate(t.key));

      // Delete the folder (this also deletes subfolders)
      await deleteFolder(folder.key);

      // Refresh templates
      await refreshTemplates();

      // If we deleted the currently selected folder, go to root
      if (selectedFolderId === folder.key || folderIdsToDelete.has(selectedFolderId || '')) {
        setSelectedFolderId(null);
      }

      showSuccessToast(t('folders.folderDeleted', { name: folder.data.name }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      showErrorToast(t('folders.deleteFailed'));
    } finally {
      setIsDeletingFolder(false);
    }
  }, [allTemplates, confirm, deleteFolder, folderTree, refreshTemplates, removeRecentTemplate, selectedFolderId, t]);

  const handleDeleteFolderFiles = useCallback(async (folder: Folder) => {
    // Get all folder IDs (folder + all subfolders)
    const folderIdsToCheck = new Set(getAllSubfolderIds(folder.key, folderTree));

    // Count templates in this folder and all subfolders
    const templatesInFolders = allTemplates.filter(t =>
      t.data.folderId && folderIdsToCheck.has(t.data.folderId)
    );

    if (templatesInFolders.length === 0) {
      showErrorToast(t('folders.noFilesToDelete'));
      return;
    }

    // Confirm deletion
    const confirmed = await confirm({
      title: t('folders.deleteFilesConfirm', { name: folder.data.name }),
      message: `${t('folders.deleteFilesDetail', { count: templatesInFolders.length })}\n\n${t('folders.cannotUndo')}`,
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    // Show loading spinner
    setIsDeletingFolder(true);

    try {
      // Build storage asset map and delete all templates
      const storageAssetMap = await buildStorageAssetMap();
      await deleteTemplates(templatesInFolders, storageAssetMap);

      // Remove deleted templates from recent list
      templatesInFolders.forEach(t => removeRecentTemplate(t.key));

      // Refresh templates
      await refreshTemplates();

      showSuccessToast(t('folders.filesDeleted', { count: templatesInFolders.length }));
    } catch (error) {
      console.error('Failed to delete files:', error);
      showErrorToast(t('folders.deleteFilesFailed'));
    } finally {
      setIsDeletingFolder(false);
    }
  }, [allTemplates, confirm, folderTree, refreshTemplates, removeRecentTemplate, t]);

  const handleFolderDialogConfirm = useCallback(async (name: string) => {
    if (folderDialogState.mode === 'create') {
      const parentId = folderDialogState.parentFolder?.key ?? null;
      const newFolderKey = await createFolder(name, parentId);
      if (newFolderKey) {
        setFolderDialogState({ isOpen: false, mode: 'create' });
        // Select the newly created folder
        setSelectedFolderId(newFolderKey);
      }
    } else if (folderDialogState.mode === 'rename' && folderDialogState.existingFolder) {
      const folder = folderDialogState.existingFolder;
      const oldPath = folder.data.path;

      // Rename the folder
      const success = await renameFolder(folder.key, name);

      if (success) {
        // Update all templates in this folder with new paths in parallel
        const templatesInFolder = allTemplates.filter(t => t.data.folderId === folder.key);
        const updatedFolder = getFolderById(folder.key);

        if (updatedFolder) {
          const newPath = updatedFolder.data.path;

          if (templatesInFolder.length > 0) {
            await Promise.all(
              templatesInFolder.map((template) => {
                const oldFullPath = template.data.fullPath || `${oldPath}/${template.data.name}`;
                const newFullPath = updateTemplatePathAfterRename(oldFullPath, oldPath, newPath);

                return setDocWithTimeout({
                  collection: 'templates_meta',
                  doc: {
                    ...template,
                    data: {
                      ...template.data,
                      folderPath: newPath,
                      fullPath: newFullPath
                    }
                  }
                });
              })
            );
          }

          await refreshTemplates();
        }

        setFolderDialogState({ isOpen: false, mode: 'create' });
      }
    }
  }, [folderDialogState, createFolder, renameFolder, allTemplates, getFolderById, refreshTemplates]);

  const handleFolderDialogCancel = useCallback(() => {
    setFolderDialogState({ isOpen: false, mode: 'create' });
  }, []);

  // Sidebar callbacks
  const handleToggleFoldersExpanded = useCallback(() => {
    if (foldersExpanded) {
      setCollapseAllTrigger(prev => prev + 1);
    } else {
      setExpandAllTrigger(prev => prev + 1);
    }
    setFoldersExpanded(prev => !prev);
  }, [foldersExpanded]);

  const handleToggleSortOrder = useCallback(() => {
    setFolderSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const handleSidebarUploadSuccess = useCallback(async (uploadedToFolderId: string | null | undefined) => {
    await refreshTemplates();
    if (uploadedToFolderId !== undefined) {
      setSelectedFolderId(uploadedToFolderId);
    }
  }, [refreshTemplates]);

  const handleUploadToFolder = useCallback((folderId: string) => {
    setUploadToFolderId(folderId);
    folderUploadInputRef.current?.click();
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    // File size limits
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const WARNING_FILE_SIZE = 25 * 1024 * 1024; // 25MB

    const files = Array.from(e.dataTransfer.files);
    let validFiles = files.filter(file => file.name.endsWith('.docx'));

    if (validFiles.length === 0) {
      showErrorToast(t('fileUpload.invalidFileType'));
      return;
    }

    if (validFiles.length < files.length) {
      import('../../utils/toast').then(({ showWarningToast }) => {
        showWarningToast(t('fileUpload.someFilesInvalid'));
      });
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
      import('../../utils/toast').then(({ showWarningToast }) => {
        largeFiles.forEach(file => {
          showWarningToast(t('fileUpload.fileLargeWarning', {
            filename: file.name,
            size: Math.round(file.size / (1024 * 1024))
          }));
        });
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    setDraggedFiles(validFiles);
    setShowDropModeDialog(true);
  }, [t]);

  const handleDropModeSelection = async (mode: 'save' | 'saveAndProcess' | 'oneTime') => {
    if (draggedFiles.length === 0) return;

    if (mode === 'oneTime') {
      setShowDropModeDialog(false);
      const fileToProcess = draggedFiles[0];
      setDraggedFiles([]);
      setOneTimeFile(fileToProcess);
      navigate('/app/process');
      return;
    }

    // Save or Save and Process mode
    setIsFolderUploading(true);
    setShowDropModeDialog(false);
    let successCount = 0;
    const failedFiles: string[] = [];
    let savedTemplateKey: string | null = null;

    try {
      // Get existing files to check for duplicates
      const docs = await listDocsWithTimeout({ collection: 'templates_meta' });
      const existingFiles = new Set(
        docs.items
          .filter(doc => {
            const data = doc.data as WordTemplateData;
            return (data.folderId ?? null) === selectedFolderId;
          })
          .map(doc => (doc.data as WordTemplateData).name)
      );

      const folderData = selectedFolderId ? getFolderById(selectedFolderId) : null;
      const folderPath = folderData?.data.path || '/';

      for (let i = 0; i < draggedFiles.length; i++) {
        const file = draggedFiles[i];

        // Update progress - preparing
        setUploadProgress({
          currentFile: i + 1,
          totalFiles: draggedFiles.length,
          currentFileName: file.name,
          status: 'preparing'
        });

        if (existingFiles.has(file.name)) {
          const { showWarningToast } = await import('../../utils/toast');
          showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
          failedFiles.push(file.name);
          continue;
        }

        try {
          const fullPath = buildTemplatePath(folderPath, file.name);

          // Extract custom properties from the file
          const { customPropertyCount } = await extractMetadataFromFile(file);

          const templateData: WordTemplateData = {
            name: file.name,
            size: file.size,
            uploadedAt: Date.now(),
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: selectedFolderId,
            folderPath: folderPath,
            fullPath: fullPath,
            customPropertyCount
          };

          // Update progress - uploading
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: draggedFiles.length,
            currentFileName: file.name,
            status: 'uploading'
          });

          const result = await uploadFileWithTimeout({
            data: file,
            collection: 'templates',
            filename: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
          });

          // Update progress - saving metadata
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: draggedFiles.length,
            currentFileName: file.name,
            status: 'saving'
          });

          await setDocWithTimeout({
            collection: 'templates_meta',
            doc: {
              key: result.name,
              data: {
                ...templateData,
                url: result.downloadUrl
              }
            }
          });

          savedTemplateKey = result.name;
          successCount++;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          failedFiles.push(file.name);
        }
      }

      if (successCount > 0) {
        if (successCount === 1) {
          showSuccessToast(t('fileUpload.uploadSuccess', { filename: draggedFiles[0].name }));
        } else {
          showSuccessToast(t('fileUpload.uploadMultipleSuccess', { count: successCount }));
        }
        await refreshTemplates();
      }

      if (failedFiles.length > 0) {
        showErrorToast(t('fileUpload.uploadMultipleFailed', { count: failedFiles.length }));
      }

      setDraggedFiles([]);

      if (mode === 'saveAndProcess' && savedTemplateKey) {
        navigate(`/app/process?id=${savedTemplateKey}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast(t('fileUpload.uploadFailed'));
    } finally {
      setIsFolderUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDropDialogCancel = useCallback(() => {
    setShowDropModeDialog(false);
    setDraggedFiles([]);
  }, []);

  const handleFolderFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !uploadToFolderId) return;

    // Filter only .docx files
    const validFiles = files.filter(file => file.name.endsWith('.docx'));

    if (validFiles.length === 0) {
      const { showWarningToast } = await import('../../utils/toast');
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    if (validFiles.length < files.length) {
      const { showWarningToast } = await import('../../utils/toast');
      showWarningToast(t('fileUpload.someFilesInvalid'));
    }

    // Upload the files
    setIsFolderUploading(true);
    let successCount = 0;
    const failedFiles: string[] = [];

    try {
      // Get existing files to check for duplicates
      const docs = await listDocsWithTimeout({ collection: 'templates_meta' });
      const existingFiles = new Set(
        docs.items
          .filter(doc => {
            const data = doc.data as WordTemplateData;
            return (data.folderId ?? null) === uploadToFolderId;
          })
          .map(doc => (doc.data as WordTemplateData).name)
      );

      const folderData = getFolderById(uploadToFolderId);
      const folderPath = folderData?.data.path || '/';

      // Process each file
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        // Update progress - preparing
        setUploadProgress({
          currentFile: i + 1,
          totalFiles: validFiles.length,
          currentFileName: file.name,
          status: 'preparing'
        });

        // Check if file already exists in this folder
        if (existingFiles.has(file.name)) {
          const { showWarningToast } = await import('../../utils/toast');
          showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
          failedFiles.push(file.name);
          continue;
        }

        try {
          const fullPath = buildTemplatePath(folderPath, file.name);

          // Extract custom properties from the file
          const { customPropertyCount } = await extractMetadataFromFile(file);

          const templateData: WordTemplateData = {
            name: file.name,
            size: file.size,
            uploadedAt: Date.now(),
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: uploadToFolderId,
            folderPath: folderPath,
            fullPath: fullPath,
            customPropertyCount
          };

          // Update progress - uploading
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: validFiles.length,
            currentFileName: file.name,
            status: 'uploading'
          });

          const result = await uploadFileWithTimeout({
            data: file,
            collection: 'templates',
            filename: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
          });

          // Update progress - saving metadata
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: validFiles.length,
            currentFileName: file.name,
            status: 'saving'
          });

          await setDocWithTimeout({
            collection: 'templates_meta',
            doc: {
              key: result.name,
              data: {
                ...templateData,
                url: result.downloadUrl
              }
            }
          });

          successCount++;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          failedFiles.push(file.name);
        }
      }

      // Show appropriate success/error messages
      if (successCount > 0) {
        if (successCount === 1) {
          showSuccessToast(t('fileUpload.uploadSuccess', { filename: validFiles[0].name }));
        } else {
          showSuccessToast(t('fileUpload.uploadMultipleSuccess', { count: successCount }));
        }
        await refreshTemplates();
        // Navigate to the folder where the files were uploaded
        setSelectedFolderId(uploadToFolderId);
      }

      if (failedFiles.length > 0) {
        showErrorToast(t('fileUpload.uploadMultipleFailed', { count: failedFiles.length }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast(t('fileUpload.uploadFailed'));
    } finally {
      setIsFolderUploading(false);
      setUploadProgress(null);
      if (folderUploadInputRef.current) {
        folderUploadInputRef.current.value = '';
      }
      setUploadToFolderId(null);
    }
  };

  return (
    <>
      {/* Hidden file input for folder upload */}
      <input
        ref={folderUploadInputRef}
        type="file"
        accept=".docx"
        multiple
        onChange={handleFolderFileSelect}
        className="hidden"
      />

      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <FolderIcon className="w-5 h-5" /> {t('dashboard.title')}
        </h2>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex gap-6 relative h-[calc(100vh-9rem)]">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          folderTree={folderTree}
          filteredFolderTree={filteredFolderTree}
          foldersLoading={foldersLoading}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onDeleteFolderFiles={handleDeleteFolderFiles}
          onUploadToFolder={handleUploadToFolder}
          folderSearchQuery={folderSearchQuery}
          onFolderSearchChange={setFolderSearchQuery}
          expandAllTrigger={expandAllTrigger}
          collapseAllTrigger={collapseAllTrigger}
          foldersExpanded={foldersExpanded}
          onToggleFoldersExpanded={handleToggleFoldersExpanded}
          folderSortOrder={folderSortOrder}
          onToggleSortOrder={handleToggleSortOrder}
          onOpenExportDialog={() => setIsExportDialogOpen(true)}
          onOpenImportDialog={() => setIsImportDialogOpen(true)}
          totalTemplateCount={allTemplates.filter(t => !t.data.folderId).length}
          favoritesCount={favoriteTemplates.length}
          recentCount={recentTemplateObjects.length}
          onUploadSuccess={handleSidebarUploadSuccess}
          onOneTimeProcess={handleOneTimeProcess}
          onSaveAndProcess={handleSaveAndProcess}
        />

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main
          className="flex-1 min-w-0 h-full relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Upload in progress overlay */}
          {isFolderUploading && <UploadProgressOverlay progress={uploadProgress} />}

          {/* Folder delete in progress overlay */}
          {isDeletingFolder && <DeletingOverlay />}

          {/* Drag and drop overlay */}
          {isDragOver && <DragDropOverlay />}

          {/* File List */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <Breadcrumbs
                selectedFolderId={selectedFolderId}
                getFolderById={getFolderById}
                onSelectFolder={setSelectedFolderId}
              />
            </div>

            <div className="flex-1 min-h-0">
              <FileList
                templates={templates}
                allTemplates={allTemplates}
                loading={templatesLoading}
                onTemplateSelect={handleTemplateSelect}
                onMultiTemplateSelect={handleMultiTemplateSelect}
                onFileDeleted={refreshTemplates}
                onRemoveFromRecent={removeRecentTemplate}
                onFolderSelect={setSelectedFolderId}
                selectedFolderId={selectedFolderId}
                folderTree={folderTree}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Folder Dialog */}
      <FolderDialog
        mode={folderDialogState.mode}
        isOpen={folderDialogState.isOpen}
        parentFolder={folderDialogState.parentFolder || null}
        existingFolder={folderDialogState.existingFolder || null}
        onConfirm={handleFolderDialogConfirm}
        onCancel={handleFolderDialogCancel}
      />

      {/* Drop Mode Selection Dialog */}
      {showDropModeDialog && (
        <DropModeDialog
          files={draggedFiles}
          folderName={selectedFolderId ? getFolderById(selectedFolderId)?.data.name || t('fileUpload.rootFolder') : t('fileUpload.rootFolder')}
          onSelectMode={handleDropModeSelection}
          onCancel={handleDropDialogCancel}
        />
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        templates={allTemplates}
        folders={folders}
        folderTree={folderTree}
        fetchTemplateBlob={fetchTemplateBlob}
      />

      {/* Import Dialog */}
      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        existingTemplates={allTemplates}
        existingFolders={folders}
        onImportComplete={async () => {
          await loadFolders();
          await refreshTemplates();
        }}
      />
    </>
  );
};

export default Dashboard;
