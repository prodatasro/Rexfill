import { FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, X, Folder, FileText, AlertTriangle, Check } from 'lucide-react';
import type { Doc } from '@junobuild/core';
import { setDocWithTimeout, uploadFileWithTimeout } from '../utils/junoWithTimeout';
import PizZip from 'pizzip';
import type { WordTemplateData } from '../types/word_template';
import type { Folder as FolderType, FolderData } from '../types/folder';
import {
  parseImportZip,
  detectConflicts,
  generateUniqueName,
  createFileFromZip,
  validateZipFile,
  type ExportMetadata,
  type ConflictResolution,
  type ConflictInfo,
} from '../utils/exportImport';
import { buildStoragePath, buildTemplatePath } from '../utils/templatePathUtils';
import { buildFolderPath } from '../utils/folderUtils';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingTemplates: Doc<WordTemplateData>[];
  existingFolders: FolderType[];
  onImportComplete: () => void;
}

type ImportStep = 'select' | 'preview' | 'conflict' | 'importing' | 'complete';

interface ImportStats {
  totalFolders: number;
  totalTemplates: number;
  importedFolders: number;
  importedTemplates: number;
  skippedFolders: number;
  skippedTemplates: number;
  errors: string[];
}

const ImportDialog: FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  existingTemplates,
  existingFolders,
  onImportComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>('select');
  const [metadata, setMetadata] = useState<ExportMetadata | null>(null);
  const [zip, setZip] = useState<PizZip | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const resetState = () => {
    setStep('select');
    setMetadata(null);
    setZip(null);
    setConflicts(null);
    setConflictResolution('skip');
    setIsProcessing(false);
    setImportProgress(0);
    setImportStats(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.name.endsWith('.zip')) {
      showErrorToast(t('exportImport.invalidFileType'));
      return;
    }

    const isValid = await validateZipFile(file);
    if (!isValid) {
      showErrorToast(t('exportImport.invalidZipFile'));
      return;
    }

    setIsProcessing(true);

    try {
      const { metadata: parsedMetadata, zip: parsedZip } = await parseImportZip(file);
      setMetadata(parsedMetadata);
      setZip(parsedZip);

      // Detect conflicts
      const detectedConflicts = detectConflicts(
        parsedMetadata,
        existingTemplates,
        existingFolders
      );
      setConflicts(detectedConflicts);

      // Move to preview or conflict step
      if (detectedConflicts.folderConflicts.length > 0 || detectedConflicts.templateConflicts.length > 0) {
        setStep('conflict');
      } else {
        setStep('preview');
      }
    } catch (error) {
      console.error('Failed to parse backup file:', error);
      showErrorToast(t('exportImport.parseError'));
      resetState();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      showErrorToast(t('exportImport.invalidFileType'));
      return;
    }

    // Create a synthetic event to reuse the handler
    const syntheticEvent = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await handleFileSelect(syntheticEvent);
  }, [existingTemplates, existingFolders, t]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    if (!metadata || !zip) return;

    setStep('importing');
    setIsProcessing(true);
    setImportProgress(0);

    const stats: ImportStats = {
      totalFolders: metadata.folders.length,
      totalTemplates: metadata.templates.length,
      importedFolders: 0,
      importedTemplates: 0,
      skippedFolders: 0,
      skippedTemplates: 0,
      errors: [],
    };

    try {
      // Create mapping for folder keys (old -> new)
      const folderKeyMapping = new Map<string, string>();
      const existingFolderPaths = existingFolders.map((f) => f.data.path);
      const existingFolderNames = existingFolders.map((f) => f.data.name);

      // Sort folders by level to ensure parents are created first
      const sortedFolders = [...metadata.folders].sort(
        (a, b) => a.data.level - b.data.level
      );

      // Import folders
      for (let i = 0; i < sortedFolders.length; i++) {
        const importFolder = sortedFolders[i];
        const existingConflict = conflicts?.folderConflicts.find(
          (c) => c.importFolder.key === importFolder.key
        );

        try {
          if (existingConflict) {
            if (conflictResolution === 'skip') {
              // Map to existing folder
              folderKeyMapping.set(importFolder.key, existingConflict.existingFolder.key);
              stats.skippedFolders++;
              continue;
            } else if (conflictResolution === 'overwrite') {
              // Update existing folder
              await setDocWithTimeout({
                collection: 'folders',
                doc: {
                  ...existingConflict.existingFolder,
                  data: {
                    ...importFolder.data,
                    updatedAt: Date.now(),
                  },
                },
              });
              folderKeyMapping.set(importFolder.key, existingConflict.existingFolder.key);
              stats.importedFolders++;
              continue;
            }
            // For 'rename', fall through to create new
          }

          // Create new folder (or rename if conflict)
          let newName = importFolder.data.name;
          let newPath = importFolder.data.path;
          let newKey = importFolder.key;

          if (existingConflict && conflictResolution === 'rename') {
            newName = generateUniqueName(importFolder.data.name, existingFolderNames, true);
            // Update parent reference if needed
            const parentId = importFolder.data.parentId
              ? folderKeyMapping.get(importFolder.data.parentId) || importFolder.data.parentId
              : null;
            const parentFolder = parentId
              ? existingFolders.find((f) => f.key === parentId)
              : null;
            newPath = buildFolderPath(newName, parentFolder?.data.path || null);
            newKey = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            existingFolderNames.push(newName);
            existingFolderPaths.push(newPath);
          }

          // Map parent ID if it was imported earlier
          const mappedParentId = importFolder.data.parentId
            ? folderKeyMapping.get(importFolder.data.parentId) || importFolder.data.parentId
            : null;

          await setDocWithTimeout({
            collection: 'folders',
            doc: {
              key: newKey,
              data: {
                ...importFolder.data,
                name: newName,
                path: newPath,
                parentId: mappedParentId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as FolderData,
            },
          });

          folderKeyMapping.set(importFolder.key, newKey);
          stats.importedFolders++;
        } catch (error) {
          console.error(`Failed to import folder ${importFolder.data.name}:`, error);
          stats.errors.push(`Folder: ${importFolder.data.name}`);
        }

        setImportProgress(Math.round(((i + 1) / (sortedFolders.length + metadata.templates.length)) * 100));
      }

      // Import templates
      const existingTemplateNames = existingTemplates.map((t) => ({
        name: t.data.name,
        folderId: t.data.folderId || null,
      }));

      for (let i = 0; i < metadata.templates.length; i++) {
        const importTemplate = metadata.templates[i];
        const existingConflict = conflicts?.templateConflicts.find(
          (c) => c.importTemplate.key === importTemplate.key
        );

        try {
          if (existingConflict) {
            if (conflictResolution === 'skip') {
              stats.skippedTemplates++;
              continue;
            } else if (conflictResolution === 'overwrite') {
              // Get file from ZIP
              const file = createFileFromZip(zip, importTemplate);
              if (!file) {
                stats.errors.push(`Template: ${importTemplate.data.name} (file not found in archive)`);
                continue;
              }

              // Upload file to storage (overwriting)
              const storagePath = buildStoragePath(
                existingConflict.existingTemplate.data.fullPath ||
                  existingConflict.existingTemplate.key
              );
              const result = await uploadFileWithTimeout({
                data: file,
                collection: 'templates',
                filename: storagePath,
              });

              // Update metadata
              await setDocWithTimeout({
                collection: 'templates_meta',
                doc: {
                  ...existingConflict.existingTemplate,
                  data: {
                    ...existingConflict.existingTemplate.data,
                    ...importTemplate.data,
                    url: result.downloadUrl,
                    uploadedAt: Date.now(),
                  },
                },
              });

              stats.importedTemplates++;
              continue;
            }
            // For 'rename', fall through to create new
          }

          // Get file from ZIP
          const file = createFileFromZip(zip, importTemplate);
          if (!file) {
            stats.errors.push(`Template: ${importTemplate.data.name} (file not found in archive)`);
            continue;
          }

          // Map folder ID if it was imported
          const mappedFolderId = importTemplate.data.folderId
            ? folderKeyMapping.get(importTemplate.data.folderId) || importTemplate.data.folderId
            : null;

          // Get folder path for the mapped folder
          let folderPath = '';
          if (mappedFolderId) {
            const folder = existingFolders.find((f) => f.key === mappedFolderId);
            if (folder) {
              folderPath = folder.data.path;
            } else {
              // Folder was just created, find it in metadata
              const importedFolder = metadata.folders.find(
                (f) => folderKeyMapping.get(f.key) === mappedFolderId
              );
              if (importedFolder) {
                folderPath = importedFolder.data.path;
              }
            }
          }

          // Generate unique name if conflict with rename resolution
          let newName = importTemplate.data.name;
          if (existingConflict && conflictResolution === 'rename') {
            const namesInSameFolder = existingTemplateNames
              .filter((t) => t.folderId === mappedFolderId)
              .map((t) => t.name);
            newName = generateUniqueName(importTemplate.data.name, namesInSameFolder, false);
            existingTemplateNames.push({ name: newName, folderId: mappedFolderId });
          }

          // Build full path
          const fullPath = buildTemplatePath(folderPath || '/', newName);
          const storagePath = buildStoragePath(fullPath);

          // Upload file
          const renamedFile = new File([file], newName, { type: file.type });
          const result = await uploadFileWithTimeout({
            data: renamedFile,
            collection: 'templates',
            filename: storagePath,
          });

          // Create metadata
          const newKey = storagePath.replace(/\//g, '_').replace(/\./g, '_');
          await setDocWithTimeout({
            collection: 'templates_meta',
            doc: {
              key: newKey,
              data: {
                ...importTemplate.data,
                name: newName,
                url: result.downloadUrl,
                folderId: mappedFolderId,
                folderPath: folderPath || '/',
                fullPath,
                uploadedAt: Date.now(),
              } as WordTemplateData,
            },
          });

          stats.importedTemplates++;
        } catch (error) {
          console.error(`Failed to import template ${importTemplate.data.name}:`, error);
          stats.errors.push(`Template: ${importTemplate.data.name}`);
        }

        setImportProgress(
          Math.round(
            ((sortedFolders.length + i + 1) / (sortedFolders.length + metadata.templates.length)) *
              100
          )
        );
      }

      setImportStats(stats);
      setStep('complete');

      // Show appropriate toast
      if (stats.errors.length === 0) {
        showSuccessToast(
          t('exportImport.importSuccess', {
            templates: stats.importedTemplates,
            folders: stats.importedFolders,
          })
        );
      } else if (stats.importedFolders > 0 || stats.importedTemplates > 0) {
        showWarningToast(
          t('exportImport.importPartial', {
            imported: stats.importedFolders + stats.importedTemplates,
            errors: stats.errors.length,
          })
        );
      } else {
        showErrorToast(t('exportImport.importFailed'));
      }

      onImportComplete();
    } catch (error) {
      console.error('Import failed:', error);
      showErrorToast(t('exportImport.importFailed'));
      setStep('select');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSelectStep = () => (
    <div className="p-6 space-y-4">
      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('import-file-input')?.click()}
      >
        <input
          id="import-file-input"
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          {t('exportImport.dropFileHere')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
          {t('exportImport.orClickToSelect')}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-3">
          {t('exportImport.acceptedFormat')}
        </p>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('exportImport.analyzing')}</span>
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => (
    <div className="p-6 space-y-4">
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
        <h4 className="font-medium text-slate-900 dark:text-slate-100">
          {t('exportImport.backupContents')}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {metadata?.templates.length || 0} {t('exportImport.templates')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {metadata?.folders.length || 0} {t('exportImport.folders')}
            </span>
          </div>
        </div>
        {metadata && (
          <p className="text-xs text-slate-500 dark:text-slate-500">
            {t('exportImport.exportedOn', {
              date: new Date(metadata.exportedAt).toLocaleString(),
            })}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-700 dark:text-green-400">
        <Check className="w-5 h-5 shrink-0" />
        <span className="text-sm">{t('exportImport.noConflicts')}</span>
      </div>
    </div>
  );

  const renderConflictStep = () => (
    <div className="p-6 space-y-4">
      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {t('exportImport.conflictsDetected')}
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            {t('exportImport.conflictsDescription', {
              folders: conflicts?.folderConflicts.length || 0,
              templates: conflicts?.templateConflicts.length || 0,
            })}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('exportImport.conflictResolution')}
        </h4>

        <label className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <input
            type="radio"
            name="conflict"
            value="skip"
            checked={conflictResolution === 'skip'}
            onChange={() => setConflictResolution('skip')}
            className="mt-1"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {t('exportImport.skipExisting')}
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('exportImport.skipExistingDesc')}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <input
            type="radio"
            name="conflict"
            value="overwrite"
            checked={conflictResolution === 'overwrite'}
            onChange={() => setConflictResolution('overwrite')}
            className="mt-1"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {t('exportImport.overwrite')}
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('exportImport.overwriteDesc')}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <input
            type="radio"
            name="conflict"
            value="rename"
            checked={conflictResolution === 'rename'}
            onChange={() => setConflictResolution('rename')}
            className="mt-1"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {t('exportImport.rename')}
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('exportImport.renameDesc')}
            </p>
          </div>
        </label>
      </div>

      {/* Conflict details */}
      {conflicts && (conflicts.folderConflicts.length > 0 || conflicts.templateConflicts.length > 0) && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-32 overflow-y-auto">
          <div className="p-3 space-y-1">
            {conflicts.folderConflicts.map((c) => (
              <div key={c.importFolder.key} className="flex items-center gap-2 text-sm">
                <Folder className="w-3 h-3 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">{c.importFolder.data.name}</span>
              </div>
            ))}
            {conflicts.templateConflicts.map((c) => (
              <div key={c.importTemplate.key} className="flex items-center gap-2 text-sm">
                <FileText className="w-3 h-3 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">{c.importTemplate.data.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderImportingStep = () => (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {t('exportImport.importing')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('exportImport.pleaseWait')}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            {t('exportImport.progress')}
          </span>
          <span className="text-slate-600 dark:text-slate-400">{importProgress}%</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${importProgress}%` }}
          />
        </div>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {t('exportImport.importComplete')}
        </p>
      </div>

      {importStats && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-600 dark:text-slate-400">
              {t('exportImport.foldersImported')}:
            </div>
            <div className="text-slate-900 dark:text-slate-100 font-medium">
              {importStats.importedFolders}
            </div>

            <div className="text-slate-600 dark:text-slate-400">
              {t('exportImport.templatesImported')}:
            </div>
            <div className="text-slate-900 dark:text-slate-100 font-medium">
              {importStats.importedTemplates}
            </div>

            {importStats.skippedFolders + importStats.skippedTemplates > 0 && (
              <>
                <div className="text-slate-600 dark:text-slate-400">
                  {t('exportImport.skipped')}:
                </div>
                <div className="text-slate-900 dark:text-slate-100 font-medium">
                  {importStats.skippedFolders + importStats.skippedTemplates}
                </div>
              </>
            )}
          </div>

          {importStats.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
                {t('exportImport.errors')} ({importStats.errors.length}):
              </p>
              <ul className="text-xs text-red-500 dark:text-red-400 space-y-0.5">
                {importStats.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>- {err}</li>
                ))}
                {importStats.errors.length > 5 && (
                  <li>... {t('exportImport.andMore', { count: importStats.errors.length - 5 })}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  const canProceed =
    (step === 'preview' || step === 'conflict') && metadata && zip && !isProcessing;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('exportImport.importTitle')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('exportImport.importDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={step === 'importing'}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'select' && renderSelectStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'conflict' && renderConflictStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          {step === 'complete' ? (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
            >
              {t('confirmDialog.ok')}
            </button>
          ) : (
            <>
              <button
                onClick={step === 'select' ? handleClose : resetState}
                disabled={step === 'importing'}
                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {step === 'select' ? t('confirmDialog.cancel') : t('exportImport.back')}
              </button>
              {canProceed && (
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t('exportImport.importButton')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
