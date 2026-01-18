import { FC, useState, useCallback, useRef, useMemo, useEffect, DragEvent, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, X, FolderPlus, Folder as FolderIcon, Search, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Loader2, Upload, Download, Archive } from 'lucide-react';
import { Doc, setDoc } from '@junobuild/core';
import { WordTemplateData } from '../types/word_template';
import type { Folder } from '../types/folder';
import FileUpload from './files/FileUpload';
import FileList from './files/FileList';
import FolderTree, { VIRTUAL_FOLDER_FAVORITES, VIRTUAL_FOLDER_RECENT } from './folders/FolderTree';
import FolderDialog from './folders/FolderDialog';
import Breadcrumbs from './Breadcrumbs';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';
import { useFolders } from '../hooks/useFolders';
import { useTemplatesByFolder } from '../hooks/useTemplatesByFolder';
import { useRecentTemplates } from '../hooks/useRecentTemplates';
import { useConfirm } from '../contexts/ConfirmContext';
import { useFileProcessing } from '../contexts/FileProcessingContext';
import { useSearch } from '../contexts/SearchContext';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { updateTemplatePathAfterRename, buildTemplatePath } from '../utils/templatePathUtils';
import { getAllSubfolderIds, buildStorageAssetMap, deleteTemplates } from '../utils/templateDeletion';
import { extractMetadataFromFile } from '../utils/extractMetadata';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';

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
  const [uploadProgress, setUploadProgress] = useState<{
    currentFile: number;
    totalFiles: number;
    currentFileName: string;
    status: 'preparing' | 'uploading' | 'saving';
  } | null>(null);

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
  const { recentTemplates, addRecentTemplate } = useRecentTemplates();

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
      const response = await fetch(template.data.url);
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
    navigate(`/process?id=${template.key}`);
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
    navigate('/process');
  };

  const handleSaveAndProcess = (templateKey: string) => {
    // Navigate to processor page with template ID (for Save & Process mode)
    navigate(`/process?id=${templateKey}`);
  };

  const handleMultiTemplateSelect = (templates: Doc<WordTemplateData>[]) => {
    // Navigate to processor page with multiple template IDs
    const ids = templates.map(t => t.key).join(',');
    navigate(`/process?ids=${ids}`);
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
  }, [allTemplates, confirm, deleteFolder, folderTree, refreshTemplates, selectedFolderId, t]);

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

      // Refresh templates
      await refreshTemplates();

      showSuccessToast(t('folders.filesDeleted', { count: templatesInFolders.length }));
    } catch (error) {
      console.error('Failed to delete files:', error);
      showErrorToast(t('folders.deleteFilesFailed'));
    } finally {
      setIsDeletingFolder(false);
    }
  }, [allTemplates, confirm, folderTree, refreshTemplates, t]);

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
        // Update all templates in this folder with new paths
        const templatesInFolder = allTemplates.filter(t => t.data.folderId === folder.key);
        const updatedFolder = getFolderById(folder.key);

        if (updatedFolder) {
          const newPath = updatedFolder.data.path;

          for (const template of templatesInFolder) {
            const oldFullPath = template.data.fullPath || `${oldPath}/${template.data.name}`;
            const newFullPath = updateTemplatePathAfterRename(oldFullPath, oldPath, newPath);

            await setDoc({
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
      import('../utils/toast').then(({ showWarningToast }) => {
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
      import('../utils/toast').then(({ showWarningToast }) => {
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
      navigate('/process');
      return;
    }

    // Save or Save and Process mode
    setIsFolderUploading(true);
    setShowDropModeDialog(false);
    let successCount = 0;
    const failedFiles: string[] = [];
    let savedTemplateKey: string | null = null;

    try {
      const { uploadFile, setDoc: setDocJuno, listDocs } = await import('@junobuild/core');

      // Get existing files to check for duplicates
      const docs = await listDocs({ collection: 'templates_meta' });
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
          const { showWarningToast } = await import('../utils/toast');
          showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
          failedFiles.push(file.name);
          continue;
        }

        try {
          const fullPath = buildTemplatePath(folderPath, file.name);

          // Extract placeholders and custom properties from the file
          const { placeholderCount, customPropertyCount } = await extractMetadataFromFile(file);

          const templateData: WordTemplateData = {
            name: file.name,
            size: file.size,
            uploadedAt: Date.now(),
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: selectedFolderId,
            folderPath: folderPath,
            fullPath: fullPath,
            placeholderCount,
            customPropertyCount
          };

          // Update progress - uploading
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: draggedFiles.length,
            currentFileName: file.name,
            status: 'uploading'
          });

          const result = await uploadFile({
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

          await setDocJuno({
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
        navigate(`/process?id=${savedTemplateKey}`);
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
      const { showWarningToast } = await import('../utils/toast');
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    if (validFiles.length < files.length) {
      const { showWarningToast } = await import('../utils/toast');
      showWarningToast(t('fileUpload.someFilesInvalid'));
    }

    // Upload the files
    setIsFolderUploading(true);
    let successCount = 0;
    const failedFiles: string[] = [];

    try {
      const { uploadFile, setDoc, listDocs } = await import('@junobuild/core');

      // Get existing files to check for duplicates
      const docs = await listDocs({ collection: 'templates_meta' });
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
          const { showWarningToast } = await import('../utils/toast');
          showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
          failedFiles.push(file.name);
          continue;
        }

        try {
          const fullPath = buildTemplatePath(folderPath, file.name);

          // Extract placeholders and custom properties from the file
          const { placeholderCount, customPropertyCount } = await extractMetadataFromFile(file);

          const templateData: WordTemplateData = {
            name: file.name,
            size: file.size,
            uploadedAt: Date.now(),
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: uploadToFolderId,
            folderPath: folderPath,
            fullPath: fullPath,
            placeholderCount,
            customPropertyCount
          };

          // Update progress - uploading
          setUploadProgress({
            currentFile: i + 1,
            totalFiles: validFiles.length,
            currentFileName: file.name,
            status: 'uploading'
          });

          const result = await uploadFile({
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

          await setDoc({
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
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-90 shrink-0
            bg-white dark:bg-slate-900 lg:bg-transparent
            border-r border-slate-200 dark:border-slate-700 lg:border-0
            transform transition-transform duration-300 ease-in-out
            lg:h-full
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="h-full flex flex-col p-4 lg:p-0">
            {/* Close button for mobile */}
            <div className="lg:hidden flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-50">Folders</h3>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-50 text-sm">{t('folders.title')}</h3>
                    <div className="flex gap-1">
                      <FileUpload
                        onUploadSuccess={async (uploadedToFolderId) => {
                          await refreshTemplates();
                          // Navigate to the folder where files were uploaded
                          if (uploadedToFolderId !== undefined) {
                            setSelectedFolderId(uploadedToFolderId);
                          }
                        }}
                        onOneTimeProcess={handleOneTimeProcess}
                        onSaveAndProcess={handleSaveAndProcess}
                        selectedFolderId={selectedFolderId}
                        folderTree={folderTree}
                        compact={true}
                      />
                      <button
                        onClick={() => handleCreateFolder(selectedFolderId)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        title={t('folders.newFolder')}
                        aria-label={t('folders.newFolder')}
                      >
                        <FolderPlus className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      </button>
                    </div>
                  </div>
                  {/* Folder search input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      placeholder={t('folders.searchPlaceholder')}
                      className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                    {folderSearchQuery && (
                      <button
                        onClick={() => setFolderSearchQuery('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      </button>
                    )}
                  </div>
                  {/* Expand/Collapse/Sort/Export/Import buttons */}
                  <div className="flex gap-1 mt-2 justify-center">
                    <button
                      onClick={() => {
                        if (foldersExpanded) {
                          setCollapseAllTrigger(prev => prev + 1);
                        } else {
                          setExpandAllTrigger(prev => prev + 1);
                        }
                        setFoldersExpanded(prev => !prev);
                      }}
                      className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                      title={foldersExpanded ? t('folders.collapseAll') : t('folders.expandAll')}
                      aria-label={foldersExpanded ? t('folders.collapseAll') : t('folders.expandAll')}
                    >
                      {foldersExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setFolderSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                      title={folderSortOrder === 'asc' ? t('folders.sortAZ') : t('folders.sortZA')}
                      aria-label={folderSortOrder === 'asc' ? t('folders.sortAZ') : t('folders.sortZA')}
                    >
                      {folderSortOrder === 'asc' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                    </button>
                    <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button
                      onClick={() => setIsExportDialogOpen(true)}
                      className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                      title={t('exportImport.exportTitle')}
                      aria-label={t('exportImport.exportTitle')}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsImportDialogOpen(true)}
                      className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                      title={t('exportImport.importTitle')}
                      aria-label={t('exportImport.importTitle')}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden p-2">
                  <FolderTree
                    folders={filteredFolderTree}
                    loading={foldersLoading}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={(folderId) => {
                      setSelectedFolderId(folderId);
                      setIsSidebarOpen(false); // Close sidebar on mobile after selection
                    }}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onDeleteFolderFiles={handleDeleteFolderFiles}
                    onUploadToFolder={handleUploadToFolder}
                    totalTemplateCount={allTemplates.filter(t => !t.data.folderId).length}
                    favoritesCount={favoriteTemplates.length}
                    recentCount={recentTemplateObjects.length}
                    searchQuery={folderSearchQuery}
                    expandAllTrigger={expandAllTrigger}
                    collapseAllTrigger={collapseAllTrigger}
                    sortOrder={folderSortOrder}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

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
          {isFolderUploading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
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

          {/* Folder delete in progress overlay */}
          {isDeletingFolder && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 animate-spin text-red-600 dark:text-red-400" />
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {t('folders.deleting')}
                </p>
              </div>
            </div>
          )}

          {/* Drag and drop overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 backdrop-blur-sm rounded-lg flex items-center justify-center z-50 border-4 border-dashed border-blue-500 dark:border-blue-400 pointer-events-none">
              <div className="flex flex-col items-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <Upload className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {t('fileUpload.dropFilesHere')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('fileUpload.dropFilesHint')}
                </p>
              </div>
            </div>
          )}

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
      {showDropModeDialog && draggedFiles.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 sm:p-8 relative">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              {t('fileUpload.uploadModeTitle')}
            </h3>

            {/* Show dropped files */}
            <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('fileUpload.selectedFiles', { count: draggedFiles.length })}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {draggedFiles.map((file, index) => (
                  <div key={index} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    • {file.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Current folder info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {t('fileUpload.uploadToFolder')}: <span className="font-semibold">{selectedFolderId ? getFolderById(selectedFolderId)?.data.name : t('fileUpload.rootFolder')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleDropModeSelection('save')}
                className="w-full text-left p-4 rounded-xl border-2 border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 shrink-0 text-purple-600 dark:text-purple-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                  </div>
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
                onClick={() => handleDropModeSelection('saveAndProcess')}
                disabled={draggedFiles.length > 1}
                className="w-full text-left p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 shrink-0 text-blue-600 dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.saveAndProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.saveAndProcessDesc')}
                    </div>
                    {draggedFiles.length > 1 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {t('fileUpload.singleFileOnly')}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleDropModeSelection('oneTime')}
                disabled={draggedFiles.length > 1}
                className="w-full text-left p-4 rounded-xl border-2 border-green-300 dark:border-green-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 shrink-0 text-green-600 dark:text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {t('fileUpload.oneTimeProcess')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t('fileUpload.oneTimeProcessDesc')}
                    </div>
                    {draggedFiles.length > 1 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {t('fileUpload.singleFileOnly')}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={handleDropDialogCancel}
              className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all"
            >
              {t('fileUpload.cancelUpload')}
            </button>
          </div>
        </div>
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
