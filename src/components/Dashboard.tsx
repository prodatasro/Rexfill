import { FC, useState, useCallback, useRef } from 'react';
import { Menu, X, FolderPlus, Folder as FolderIcon } from 'lucide-react';
import { Doc, setDoc, deleteDoc, deleteAsset } from '@junobuild/core';
import { WordTemplateData } from '../types/word_template';
import type { Folder } from '../types/folder';
import FileUpload from './files/FileUpload';
import FileList from './files/FileList';
import { WordTemplateProcessor } from './WordTemplateProcessor';
import FolderTree from './folders/FolderTree';
import FolderDialog from './folders/FolderDialog';
import { useFolders } from '../hooks/useFolders';
import { useTemplatesByFolder } from '../hooks/useTemplatesByFolder';
import { useConfirm } from '../contexts/ConfirmContext';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { updateTemplatePathAfterRename } from '../utils/templatePathUtils';
import { useTranslation } from 'react-i18next';

const Dashboard: FC = () => {
  const { t } = useTranslation();
  const { confirm } = useConfirm();

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  // Load templates by folder
  const { templates, allTemplates, loading: templatesLoading, refresh: refreshTemplates } = useTemplatesByFolder(selectedFolderId);

  // Load folders
  const { folders, folderTree, loading: foldersLoading, createFolder, renameFolder, deleteFolder, getFolderById } = useFolders(allTemplates);

  // Handle template selection for processing
  const handleTemplateSelect = (template: Doc<WordTemplateData>) => {
    setSelectedTemplate(template);
    setSelectedFile(null);
  };

  const handleOneTimeProcess = (file: File) => {
    setSelectedFile(file);
    setSelectedTemplate(null);
  };

  const handleCloseProcessor = () => {
    setSelectedTemplate(null);
    setSelectedFile(null);
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
    // Count templates in this folder
    const templatesInFolder = allTemplates.filter(t => t.data.folderId === folder.key);

    // Confirm deletion
    const confirmed = await confirm({
      title: t('folders.deleteFolderConfirm', { name: folder.data.name }),
      message: `${t('folders.deleteFolderDetail', { count: templatesInFolder.length })}\n\n${t('folders.cannotUndo')}`,
      confirmLabel: t('confirmDialog.ok'),
      cancelLabel: t('confirmDialog.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      // Delete all templates in this folder
      for (const template of templatesInFolder) {
        const fullPath = template.data.fullPath || `/${template.data.name}`;
        await deleteAsset({
          collection: 'templates',
          fullPath: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
        });

        await deleteDoc({
          collection: 'templates_meta',
          doc: template
        });
      }

      // Delete the folder
      await deleteFolder(folder.key);

      // Refresh templates
      await refreshTemplates();

      // If we deleted the currently selected folder, go to root
      if (selectedFolderId === folder.key) {
        setSelectedFolderId(null);
      }

      showSuccessToast(t('folders.folderDeleted', { name: folder.data.name }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      showErrorToast(t('folders.deleteFailed'));
    }
  }, [allTemplates, confirm, deleteFolder, refreshTemplates, selectedFolderId, t]);

  const handleFolderDialogConfirm = useCallback(async (name: string) => {
    if (folderDialogState.mode === 'create') {
      const parentId = folderDialogState.parentFolder?.key ?? null;
      const success = await createFolder(name, parentId);
      if (success) {
        setFolderDialogState({ isOpen: false, mode: 'create' });
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

  const handleFolderFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadToFolderId) return;

    if (!file.name.endsWith('.docx')) {
      const { showWarningToast } = await import('../utils/toast');
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    // Check if file already exists in this folder
    const { listDocs } = await import('@junobuild/core');
    const docs = await listDocs({ collection: 'templates_meta' });
    const fileExists = docs.items.some(doc => {
      const data = doc.data as WordTemplateData;
      return data.name === file.name && (data.folderId ?? null) === uploadToFolderId;
    });

    if (fileExists) {
      const { showWarningToast } = await import('../utils/toast');
      showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
      if (folderUploadInputRef.current) {
        folderUploadInputRef.current.value = '';
      }
      return;
    }

    // Upload the file
    try {
      const { uploadFile, setDoc } = await import('@junobuild/core');
      const { buildTemplatePath } = await import('../utils/templatePathUtils');

      const folderData = getFolderById(uploadToFolderId);
      const folderPath = folderData?.data.path || '/';
      const fullPath = buildTemplatePath(folderPath, file.name);

      const templateData: WordTemplateData = {
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        folderId: uploadToFolderId,
        folderPath: folderPath,
        fullPath: fullPath
      };

      const result = await uploadFile({
        data: file,
        collection: 'templates',
        filename: fullPath.startsWith('/') ? fullPath.substring(1) : fullPath
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

      showSuccessToast(t('fileUpload.uploadSuccess', { filename: file.name }));
      await refreshTemplates();
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast(t('fileUpload.uploadFailed'));
    } finally {
      if (folderUploadInputRef.current) {
        folderUploadInputRef.current.value = '';
      }
      setUploadToFolderId(null);
    }
  };

  // If processing a template, show the processor
  if (selectedTemplate || selectedFile) {
    return (
      <WordTemplateProcessor
        template={selectedTemplate || undefined}
        file={selectedFile || undefined}
        onClose={handleCloseProcessor}
      />
    );
  }

  return (
    <>
      {/* Hidden file input for folder upload */}
      <input
        ref={folderUploadInputRef}
        type="file"
        accept=".docx"
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
      <div className="flex gap-6 relative h-[calc(100vh-12rem)]">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-64 flex-shrink-0
            bg-white dark:bg-slate-900 lg:bg-transparent
            border-r border-slate-200 dark:border-slate-700 lg:border-0
            transform transition-transform duration-300 ease-in-out
            lg:h-full
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="h-full p-4 lg:p-0 flex flex-col">
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

            <div className="flex-1 min-h-0">
              <FolderTree
                folders={folderTree}
                loading={foldersLoading}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(folderId) => {
                  setSelectedFolderId(folderId);
                  setIsSidebarOpen(false); // Close sidebar on mobile after selection
                }}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onUploadToFolder={handleUploadToFolder}
                totalTemplateCount={allTemplates.filter(t => !t.data.folderId).length}
              />
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
        <main className="flex-1 min-w-0">

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <FileUpload
              onUploadSuccess={async (uploadedToFolderId) => {
                await refreshTemplates();
                // Navigate to the folder where files were uploaded
                if (uploadedToFolderId !== undefined) {
                  setSelectedFolderId(uploadedToFolderId);
                }
              }}
              onOneTimeProcess={handleOneTimeProcess}
              selectedFolderId={selectedFolderId}
              folderTree={folderTree}
            />
            <button
              onClick={() => handleCreateFolder(selectedFolderId)}
              className="btn-primary text-sm sm:text-base"
            >
              <FolderPlus className="w-5 h-5" /> {t('folders.newFolder')}
            </button>
          </div>

          {/* File List */}
          <FileList
            templates={templates}
            allTemplates={allTemplates}
            loading={templatesLoading}
            onTemplateSelect={handleTemplateSelect}
            onFileDeleted={refreshTemplates}
            selectedFolderId={selectedFolderId}
            folderTree={folderTree}
          />
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
    </>
  );
};

export default Dashboard;
