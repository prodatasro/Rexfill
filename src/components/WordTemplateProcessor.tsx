import { Doc } from "@junobuild/core";
import { FC, useEffect, useCallback, useState } from "react";
import { FileText, ClipboardList, Sparkles, X, Loader2, Rocket, Save, FilePlus, Files } from 'lucide-react';
import { WordTemplateData } from "../types/word_template";
import { FolderTreeNode } from "../types/folder";
import { useTranslation } from "react-i18next";
import { useProcessor } from "../contexts/ProcessorContext";
import { useWordTemplateProcessor } from "../hooks/useWordTemplateProcessor";
import { useMultiFileProcessor } from "../hooks/useMultiFileProcessor";
import { UnsavedChangesDialog } from "./modals/UnsavedChangesDialog";
import { SaveAsDialog } from "./modals/SaveAsDialog";
import { MultiSaveAsDialog } from "./modals/MultiSaveAsDialog";
import { VirtualizedFieldList } from "./processor/VirtualizedFieldList";

interface WordTemplateProcessorProps {
  // Single file mode
  template?: Doc<WordTemplateData>;
  file?: File;
  // Multi-file mode
  templates?: Doc<WordTemplateData>[];
  files?: File[];
  // Common props
  onClose: () => void;
  folderTree: FolderTreeNode[];
  onTemplateChange?: (newTemplate: Doc<WordTemplateData>) => void;
}

export const WordTemplateProcessor: FC<WordTemplateProcessorProps> = ({
  template,
  file,
  templates = [],
  files = [],
  onClose,
  folderTree,
  onTemplateChange,
}) => {
  const { t } = useTranslation();
  const { setHasUnsavedChanges, setRequestNavigation } = useProcessor();

  // Determine if we're in multi-file mode
  const isMultiFileMode = templates.length > 1 || files.length > 1;

  // Use the appropriate hook based on mode
  const singleFileHook = useWordTemplateProcessor({
    template,
    file,
    folderTree,
    onTemplateChange,
  });

  const multiFileHook = useMultiFileProcessor({
    templates: templates,
    files: files,
  });

  // Select the active hook based on mode
  const {
    formData,
    loading,
    processing,
    hasChanges,
    allFields,
    processingProgress,
    handleInputChange,
  } = isMultiFileMode ? multiFileHook : singleFileHook;

  // Single-file specific properties
  const saving = isMultiFileMode ? multiFileHook.saving : singleFileHook.saving;
  const handleSave = isMultiFileMode ? multiFileHook.saveAllDocuments : singleFileHook.handleSave;
  const handleSaveAs = singleFileHook.handleSaveAs;
  const processDocument = isMultiFileMode ? multiFileHook.processAllDocuments : singleFileHook.processDocument;

  // Multi-file specific properties
  const { fieldData, processingTemplates, savableTemplates, saveAllDocumentsAs } = multiFileHook;

  // Expanded state for file sections in multi-file mode
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [sharedFieldsExpanded, setSharedFieldsExpanded] = useState(true);

  // Modal states
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showMultiSaveAsDialog, setShowMultiSaveAsDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

  // Initialize all files as expanded (only when IDs change)
  const processingTemplateIds = processingTemplates.map(pt => pt.id).join(',');
  useEffect(() => {
    if (isMultiFileMode && processingTemplateIds) {
      setExpandedFiles(new Set(processingTemplateIds.split(',')));
    }
  }, [isMultiFileMode, processingTemplateIds]);

  const toggleFileExpanded = (fileId: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Track changes in context
  useEffect(() => {
    setHasUnsavedChanges(hasChanges);
  }, [hasChanges, setHasUnsavedChanges]);

  // Enhanced cancel with change detection
  const handleCancel = useCallback(() => {
    if (!hasChanges) {
      onClose();
      return;
    }
    setShowUnsavedChangesDialog(true);
  }, [hasChanges, onClose]);

  // Set up navigation request handler for logo clicks
  useEffect(() => {
    setRequestNavigation(handleCancel);
  }, [setRequestNavigation, handleCancel]);

  // Cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      setRequestNavigation(null);
      setHasUnsavedChanges(false);
    };
  }, [setRequestNavigation, setHasUnsavedChanges]);

  // Save As dialog handlers
  const openSaveAsDialog = () => {
    if (isMultiFileMode) {
      setShowMultiSaveAsDialog(true);
    } else {
      setShowSaveAsDialog(true);
    }
  };

  const handleSaveAsConfirm = async (
    filename: string,
    folderId: string | null,
    newFolderData?: { name: string; parentId: string | null }
  ) => {
    const success = await handleSaveAs(filename, folderId, newFolderData);
    if (success) {
      setShowSaveAsDialog(false);
    }
  };

  // Helper to get folder path from folderId
  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return '';
    for (const node of folderTree) {
      if (node.folder.key === folderId) {
        return `/${node.folder.data.name}`;
      }
      for (const child of node.children) {
        if (child.folder.key === folderId) {
          return `/${node.folder.data.name}/${child.folder.data.name}`;
        }
      }
    }
    return '';
  };

  const handleMultiSaveAsConfirm = async (
    modifierType: 'prefix' | 'suffix',
    modifierValue: string,
    folderId: string | null,
    newFolderData?: { name: string; parentId: string | null }
  ) => {
    const folderPath = getFolderPath(folderId);
    const success = await saveAllDocumentsAs(modifierType, modifierValue, folderId, folderPath, newFolderData);
    if (success) {
      setShowMultiSaveAsDialog(false);
    }
  };

  const handleProcessAndClose = async () => {
    const success = await processDocument();
    if (success) {
      onClose();
    }
  };

  const isFormValid = true; // All fields are optional

  return (
    <div className="flex flex-col">
      {/* Save As Dialog (Single File) */}
      <SaveAsDialog
        isOpen={showSaveAsDialog}
        initialFilename={file?.name || template?.data.name || 'document.docx'}
        initialFolderId={template?.data.folderId || null}
        folderTree={folderTree}
        isLoading={saving}
        onConfirm={handleSaveAsConfirm}
        onClose={() => setShowSaveAsDialog(false)}
      />

      {/* Multi Save As Dialog */}
      <MultiSaveAsDialog
        isOpen={showMultiSaveAsDialog}
        fileNames={processingTemplates.map(pt => pt.fileName)}
        initialFolderId={templates[0]?.data.folderId || null}
        folderTree={folderTree}
        isLoading={saving}
        onConfirm={handleMultiSaveAsConfirm}
        onClose={() => setShowMultiSaveAsDialog(false)}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        hasTemplate={!!template}
        isLoading={saving}
        onSave={handleSave}
        onSaveAs={openSaveAsDialog}
        onDiscard={onClose}
        onClose={() => setShowUnsavedChangesDialog(false)}
      />

      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-purple-600 p-4 sm:p-6 shadow-lg rounded-t-lg">
        <div className="flex justify-between items-center">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 flex items-center gap-2">
              {isMultiFileMode ? (
                <>
                  <Files className="w-6 h-6" /> {t('templateProcessor.multiFileTitle', { count: processingTemplates.length })}
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6" /> {t('templateProcessor.title')}
                </>
              )}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm truncate">
              {isMultiFileMode
                ? processingTemplates.map(pt => pt.fileName).join(', ')
                : (file ? file.name : template?.data.name)
              }
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-white hover:text-red-200 transition-colors p-2 rounded-full hover:bg-white/10 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-32 rounded-b-lg">
        <div className="p-4 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium">
                {t('templateProcessor.analyzing')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allFields.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <ClipboardList className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
                  <p className="text-slate-600 dark:text-slate-300 text-lg sm:text-xl mb-2">
                    {t('templateProcessor.noPlaceholders')}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
                    {t('templateProcessor.noPlaceholdersDesc')}
                  </p>
                </div>
              ) : (
                /* PERFORMANCE OPTIMIZED: Virtualized field list for both modes */
                <>
                  {/* Single-file mode header */}
                  {!isMultiFileMode && (
                    <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                          {t('templateProcessor.customizationTitle')}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: t('templateProcessor.customizationDesc', { count: allFields.length }) }}>
                      </p>
                    </div>
                  )}

                  {/* Virtualized field list - handles both single and multi-file modes */}
                  <VirtualizedFieldList
                    fields={!isMultiFileMode ? allFields : undefined}
                    customPropertiesRecord={!isMultiFileMode ? singleFileHook.customProperties : undefined}
                    sharedFields={isMultiFileMode ? fieldData.sharedFields : undefined}
                    fileFields={isMultiFileMode ? fieldData.fileFields : undefined}
                    expandedFiles={expandedFiles}
                    sharedFieldsExpanded={sharedFieldsExpanded}
                    isCustomProperty={isMultiFileMode ? fieldData.isCustomProperty : undefined}
                    formData={formData}
                    onInputChange={handleInputChange}
                    onToggleSection={toggleFileExpanded}
                    onToggleSharedFields={() => setSharedFieldsExpanded(!sharedFieldsExpanded)}
                    isMultiFileMode={isMultiFileMode}
                    fileCount={processingTemplates.length}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons at bottom */}
      {!loading && allFields.length > 0 && (
        <div className="sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 rounded-b-lg">
          {/* Loading indicator above buttons */}
          {(saving || processing) && (
            <div className="py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {processingProgress
                    ? t(`templateProcessor.progress.${processingProgress.stage}`)
                    : saving
                      ? t('templateProcessor.saving')
                      : t('templateProcessor.processing')}
                </span>
              </div>
              {processingProgress && (
                <div className="mx-4">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${processingProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Button container */}
          <div className="flex justify-center py-4">
            <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 w-full sm:w-auto px-4 sm:px-0">
              {/* Save button - for saved templates (single-file or multi-file mode) */}
              {((!isMultiFileMode && template) || (isMultiFileMode && savableTemplates.length > 0)) && (
                <button
                  onClick={handleSave}
                  disabled={!isFormValid || saving || processing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white font-bold py-3 px-3 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
                >
                  <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-base">
                      {isMultiFileMode
                        ? t('templateProcessor.saveAll', { count: savableTemplates.length })
                        : t('templateProcessor.save')
                      }
                    </span>
                  </span>
                </button>
              )}

              {/* Save As button - shown in both single and multi-file modes */}
              <button
                onClick={openSaveAsDialog}
                disabled={!isFormValid || saving || processing}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white font-bold py-3 px-3 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <FilePlus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base">{t('templateProcessor.saveAs')}</span>
                </span>
              </button>

              {/* Generate (Download) button */}
              <button
                onClick={handleProcessAndClose}
                disabled={!isFormValid || saving || processing}
                className="bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-3 px-3 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base">
                    {isMultiFileMode
                      ? t('templateProcessor.generateAllDocuments', { count: processingTemplates.length })
                      : t('templateProcessor.generateDocument')
                    }
                  </span>
                </span>
              </button>

              {/* Cancel button */}
              <button
                onClick={handleCancel}
                disabled={saving || processing}
                className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 disabled:bg-slate-400 text-white font-semibold py-3 px-3 sm:px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl"
              >
                <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base">{t('templateProcessor.cancel')}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
