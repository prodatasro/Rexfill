import { Doc } from "@junobuild/core";
import { FC, useEffect, useCallback } from "react";
import { FileText, ClipboardList, Sparkles, X, Tag, Loader2, Check, Rocket, Save, FilePlus } from 'lucide-react';
import { WordTemplateData } from "../types/word_template";
import { FolderTreeNode } from "../types/folder";
import { useTranslation } from "react-i18next";
import { useProcessor } from "../contexts/ProcessorContext";
import { useWordTemplateProcessor } from "../hooks/useWordTemplateProcessor";
import { UnsavedChangesDialog } from "./modals/UnsavedChangesDialog";
import { SaveAsDialog } from "./modals/SaveAsDialog";
import { useState } from "react";

interface WordTemplateProcessorProps {
  template?: Doc<WordTemplateData>;
  file?: File;
  onClose: () => void;
  folderTree: FolderTreeNode[];
  onTemplateChange?: (newTemplate: Doc<WordTemplateData>) => void;
}

export const WordTemplateProcessor: FC<WordTemplateProcessorProps> = ({
  template,
  file,
  onClose,
  folderTree,
  onTemplateChange,
}) => {
  const { t } = useTranslation();
  const { setHasUnsavedChanges, setRequestNavigation } = useProcessor();

  // Use the custom hook for business logic
  const {
    formData,
    customProperties,
    loading,
    processing,
    saving,
    hasChanges,
    allFields,
    handleInputChange,
    processDocument,
    handleSave,
    handleSaveAs,
  } = useWordTemplateProcessor({
    template,
    file,
    folderTree,
    onTemplateChange,
  });

  // Modal states
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

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
    setShowSaveAsDialog(true);
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

  const handleProcessAndClose = async () => {
    const success = await processDocument();
    if (success) {
      onClose();
    }
  };

  const isFormValid = true; // All fields are optional

  return (
    <div className="flex flex-col">
      {/* Save As Dialog */}
      <SaveAsDialog
        isOpen={showSaveAsDialog}
        initialFilename={file?.name || template?.data.name || 'document.docx'}
        initialFolderId={template?.data.folderId || null}
        folderTree={folderTree}
        isLoading={saving}
        onConfirm={handleSaveAsConfirm}
        onClose={() => setShowSaveAsDialog(false)}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        hasTemplate={!!template}
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
              <FileText className="w-6 h-6" /> {t('templateProcessor.title')}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm truncate">
              {file ? file.name : template?.data.name}
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
                <>
                  <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                        {t('templateProcessor.customizationTitle')}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: t('templateProcessor.customizationDesc', { count: allFields.length }) }}>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {allFields.map((fieldName) => (
                      <div key={fieldName} className="space-y-1">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
                          <span className="inline-flex items-center gap-1.5">
                            {fieldName in customProperties ? (
                              <FileText className="w-3.5 h-3.5" />
                            ) : (
                              <Tag className="w-3.5 h-3.5" />
                            )}
                            {fieldName}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData[fieldName] || ''}
                            onChange={(e) => handleInputChange(fieldName, e.target.value)}
                            className="w-full px-3 py-2 sm:px-4 sm:py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500"
                            placeholder={t('templateProcessor.enterValue', { placeholder: fieldName })}
                            autoComplete="off"
                          />
                          {formData[fieldName]?.trim() && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Check className="w-4 h-4 text-green-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
            <div className="flex items-center justify-center gap-2 py-3 border-b border-slate-200 dark:border-slate-700">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {saving ? t('templateProcessor.saving') : t('templateProcessor.processing')}
              </span>
            </div>
          )}

          {/* Button container */}
          <div className="flex justify-center py-4">
            <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 w-full sm:w-auto px-4 sm:px-0">
              {/* Save button - only for saved templates */}
              {template && (
                <button
                  onClick={handleSave}
                  disabled={!isFormValid || saving || processing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white font-bold py-3 px-3 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
                >
                  <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-base">{t('templateProcessor.save')}</span>
                  </span>
                </button>
              )}

              {/* Save As button - always shown */}
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
                  <span className="text-xs sm:text-base">{t('templateProcessor.generateDocument')}</span>
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
