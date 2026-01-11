import { Doc, uploadFile, setDoc, listDocs } from "@junobuild/core";
import { FC, useEffect, useState, useCallback } from "react";
import { FileText, ClipboardList, Sparkles, X, Tag, Loader2, Check, Rocket, Save, FilePlus } from 'lucide-react';
import { WordTemplateData } from "../types/word_template";
import { FolderTreeNode } from "../types/folder";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { useProcessor } from "../contexts/ProcessorContext";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";
import { buildTemplatePath } from "../utils/templatePathUtils";

interface WordTemplateProcessorProps {
  template?: Doc<WordTemplateData>;
  file?: File;
  onClose: () => void;
  folderTree: FolderTreeNode[];
}

export const WordTemplateProcessor: FC<WordTemplateProcessorProps> = ({
  template,
  file,
  onClose,
  folderTree,
}) => {
  const { t } = useTranslation();
  const { setHasUnsavedChanges, setRequestNavigation } = useProcessor();
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [initialFormData, setInitialFormData] = useState<Record<string, string>>({});
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Save As dialog state
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsFilename, setSaveAsFilename] = useState('');
  const [saveAsFolderId, setSaveAsFolderId] = useState<string | null>(null);
  const [saveAsLoading, setSaveAsLoading] = useState(false);

  // Unsaved changes dialog state
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

  useEffect(() => {
    extractPlaceholdersAndProperties();
  }, [template, file]);

  const extractPlaceholdersAndProperties = async () => {
    try {
      let arrayBuffer: ArrayBuffer;

      if (file) {
        // One-time processing - read file directly
        arrayBuffer = await file.arrayBuffer();
      } else if (template?.data.url) {
        // Saved template - fetch from URL
        const response = await fetch(template.data.url);
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error("No file or template provided");
      }
      const zip = new PizZip(arrayBuffer);

      // Read custom properties from the document
      const docCustomProperties = readCustomProperties(zip);
      setCustomProperties(docCustomProperties);

      // Extract the document.xml file directly to get all text content
      const documentXml = zip.file("word/document.xml");
      if (!documentXml) {
        throw new Error("Could not find document.xml in the Word file");
      }

      const xmlContent = documentXml.asText();

      // Parse XML to handle runs properly
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

      // Extract text from all text runs and concatenate to reconstruct original text
      const textRuns = xmlDoc.getElementsByTagName("w:t");
      let reconstructedText = "";

      for (let i = 0; i < textRuns.length; i++) {
        const textNode = textRuns[i];
        reconstructedText += textNode.textContent || "";
      }

      // Extract placeholders from reconstructed text
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = reconstructedText.match(placeholderRegex) || [];
      const uniquePlaceholders = [...new Set(matches.map(match => match.slice(2, -2).trim()))];

      setPlaceholders(uniquePlaceholders);

      // Initialize form data with both placeholders and custom properties
      const initialFormData: Record<string, string> = {};

      // Add placeholders
      uniquePlaceholders.forEach(placeholder => {
        initialFormData[placeholder] = '';
      });

      // Add custom properties
      Object.entries(docCustomProperties).forEach(([key, value]) => {
        initialFormData[key] = value;
      });

      setInitialFormData(initialFormData);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error extracting placeholders and properties:', error);
    } finally {
      setLoading(false);
    }
  };

  // Track changes to form data
  useEffect(() => {
    const changed = Object.keys(formData).some(
      key => formData[key] !== (initialFormData[key] || '')
    );
    console.log('Change detection:', { formData, initialFormData, changed });
    setHasChanges(changed);
    setHasUnsavedChanges(changed);
  }, [formData, initialFormData, setHasUnsavedChanges]);

  const handleInputChange = (placeholder: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [placeholder]: value
    }));
  };

  // Shared function to generate processed blob - used by Save, Save As, and Generate
  const generateProcessedBlob = async (): Promise<{ blob: Blob; fileName: string }> => {
    let arrayBuffer: ArrayBuffer;

    if (file) {
      // One-time processing - read file directly
      arrayBuffer = await file.arrayBuffer();
    } else if (template?.data.url) {
      // Saved template - fetch from URL
      const response = await fetch(template.data.url);
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error("No file or template provided");
    }

    // Separate placeholders and custom properties
    const placeholderData: Record<string, string> = {};
    const customPropsData: Record<string, string> = {};

    // Determine which fields are custom properties vs placeholders
    Object.entries(formData).forEach(([key, value]) => {
      if (key in customProperties) {
        customPropsData[key] = value;
      } else {
        placeholderData[key] = value;
      }
    });

    const fileName = file ? file.name : template?.data.name || 'document.docx';

    // Try with custom module first
    try {
      const zip = new PizZip(arrayBuffer);

      // Write custom properties to the document
      if (Object.keys(customPropsData).length > 0) {
        writeCustomProperties(zip, customPropsData);
        updateDocumentFields(zip, customPropsData);
      }

      // Process placeholders with docxtemplater only if there are any
      if (placeholders.length > 0) {
        // Instead of trying to fix XML manually, let's use a different approach
        // We'll create a custom module to handle split placeholders
        const fixTextModule = {
          name: "FixTextModule",
          parse(placeHolderContent: any) {
            return placeHolderContent;
          },
          postparse(parsed: any) {
            // This runs after docxtemplater parses the document
            return parsed;
          },
          render(part: any) {
            return part;
          },
          postrender(parts: any) {
            return parts;
          },
          matchers() {
            return [];
          },
          set(options: any) {
            if (options.zip) {
              const documentXml = options.zip.file("word/document.xml");
              if (documentXml) {
                let xmlContent = documentXml.asText();

                // Simple approach: merge text nodes that contain placeholder parts
                // Look for patterns where braces are split across runs
                xmlContent = xmlContent.replace(
                  /(<w:t[^>]*>)([^<]*\{+[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*[}]+[^<]*?)(<\/w:t>)/g,
                  '$1$2$3$4'
                );

                // Handle cases where placeholders are split in the middle
                xmlContent = xmlContent.replace(
                  /(<w:t[^>]*>)([^<]*\{\{[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*\}\}[^<]*?)(<\/w:t>)/g,
                  '$1$2$3$4'
                );

                // More specific patterns for our placeholders
                placeholders.forEach(placeholder => {
                  const parts = placeholder.split('');
                  // Create regex that matches placeholder split at any position
                  for (let i = 1; i < parts.length; i++) {
                    const firstPart = '{{' + parts.slice(0, i).join('');
                    const secondPart = parts.slice(i).join('') + '}}';
                    const pattern = new RegExp(
                      `(<w:t[^>]*>)([^<]*${firstPart.replace(/[{}]/g, '\\$&')})<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*${secondPart.replace(/[{}]/g, '\\$&')}[^<]*?)(<\/w:t>)`,
                      'g'
                    );
                    xmlContent = xmlContent.replace(pattern, `$1$2$3$4`);
                  }
                });

                options.zip.file("word/document.xml", xmlContent);
              }
            }
          }
        };

        // Create Docxtemplater with the custom module
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => "",
          modules: [fixTextModule]
        });

        doc.setData(placeholderData);
        doc.render();
      }

      const blob = zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }) as Blob;

      return { blob, fileName };
    } catch (error) {
      console.error('Primary processing failed, trying fallback...', error);

      // Fallback: simpler approach without custom module
      const zip = new PizZip(arrayBuffer);

      // Write custom properties
      if (Object.keys(customPropsData).length > 0) {
        writeCustomProperties(zip, customPropsData);
        updateDocumentFields(zip, customPropsData);
      }

      // Process placeholders if any
      if (placeholders.length > 0) {
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => "",
          delimiters: {
            start: "{{",
            end: "}}"
          }
        });

        doc.setData(placeholderData);
        doc.render();
      }

      const blob = zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }) as Blob;

      return { blob, fileName };
    }
  };

  const processDocument = async () => {
    setProcessing(true);
    try {
      // Use shared blob generation logic
      const { blob, fileName } = await generateProcessedBlob();

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processed_${fileName}`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccessToast(t('templateProcessor.processSuccess'));
      onClose();
    } catch (error) {
      console.error('Error processing document:', error);
      // Try fallback approach without preprocessing
      try {
        let arrayBuffer: ArrayBuffer;

        if (file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (template?.data.url) {
          const response = await fetch(template.data.url);
          arrayBuffer = await response.arrayBuffer();
        } else {
          throw new Error("No file or template provided");
        }
        const zip = new PizZip(arrayBuffer);

        // Separate data again for fallback
        const placeholderData: Record<string, string> = {};
        const customPropsData: Record<string, string> = {};

        Object.entries(formData).forEach(([key, value]) => {
          if (key in customProperties) {
            customPropsData[key] = value;
          } else {
            placeholderData[key] = value;
          }
        });

        // Write custom properties
        if (Object.keys(customPropsData).length > 0) {
          writeCustomProperties(zip, customPropsData);
          updateDocumentFields(zip, customPropsData);
        }

        // Process placeholders if any
        if (placeholders.length > 0) {
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "",
            delimiters: {
              start: "{{",
              end: "}}"
            }
          });

          doc.setData(placeholderData);
          doc.render();
        }

        const output = zip.generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        const url = window.URL.createObjectURL(output);
        const a = document.createElement("a");
        a.href = url;
        const fileName = file ? file.name : template?.data.name || 'document.docx';
        a.download = `processed_${fileName}`;
        a.click();
        window.URL.revokeObjectURL(url);

        showSuccessToast(t('templateProcessor.processSuccess'));
        onClose();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        showErrorToast(t('templateProcessor.processError'));
      }
    } finally {
      setProcessing(false);
    }
  };

  // Save to original template
  const handleSave = async () => {
    if (!template) return; // Save only works for saved templates

    setSaving(true);
    try {
      // 1. Generate processed blob
      const { blob, fileName } = await generateProcessedBlob();

      // 2. Upload to Juno Storage (overwrite)
      const storagePath = template.data.fullPath?.startsWith('/')
        ? template.data.fullPath.substring(1)
        : template.data.fullPath || fileName;

      // Convert blob to File for upload
      const fileToUpload = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const result = await uploadFile({
        data: fileToUpload,
        collection: 'templates',
        filename: storagePath
      });

      // 3. Update metadata
      await setDoc({
        collection: 'templates_meta',
        doc: {
          ...template,
          data: {
            ...template.data,
            url: result.downloadUrl,
            size: blob.size,
            uploadedAt: Date.now()
          }
        }
      });

      // 4. Success feedback
      showSuccessToast(t('templateProcessor.saveSuccess'));
      onClose(); // Close and refresh parent

    } catch (error) {
      console.error('Save failed:', error);
      showErrorToast(t('templateProcessor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Helper function to get folder path from folder tree
  const getFolderPathById = (folderId: string | null, tree: FolderTreeNode[]): string => {
    if (!folderId) return '';

    for (const node of tree) {
      if (node.folder.key === folderId) {
        return node.folder.data.path;
      }
      if (node.children.length > 0) {
        const childPath = getFolderPathById(folderId, node.children);
        if (childPath) return childPath;
      }
    }
    return '';
  };

  // Save as new template
  const handleSaveAs = () => {
    const currentName = file?.name || template?.data.name || 'document.docx';
    const nameWithoutExt = currentName.replace(/\.docx$/i, '');
    setSaveAsFilename(nameWithoutExt);

    // Default folder: template's folder OR root for one-time files
    setSaveAsFolderId(template?.data.folderId || null);
    setShowSaveAsDialog(true);
  };

  const handleSaveAsConfirm = async () => {
    setSaveAsLoading(true);
    try {
      // 1. Validate filename
      const filename = saveAsFilename.trim();
      if (!filename) {
        showErrorToast(t('templateProcessor.saveAsInvalidFilename'));
        return;
      }

      const finalFilename = filename.endsWith('.docx')
        ? filename
        : `${filename}.docx`;

      // 2. Check if file exists in target folder
      const existingDocs = await listDocs<WordTemplateData>({
        collection: 'templates_meta',
        filter: {}
      });

      const fileExists = existingDocs.items.some(doc =>
        doc.data.name === finalFilename &&
        (doc.data.folderId || null) === saveAsFolderId
      );

      if (fileExists) {
        showErrorToast(t('templateProcessor.saveAsFileExists'));
        return;
      }

      // 3. Generate processed blob
      const { blob } = await generateProcessedBlob();

      // 4. Build path using utility
      const folderPath = getFolderPathById(saveAsFolderId, folderTree);
      const fullPath = buildTemplatePath(folderPath, finalFilename);
      const storagePath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

      // 5. Upload to Juno
      const fileToUpload = new File([blob], finalFilename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const result = await uploadFile({
        data: fileToUpload,
        collection: 'templates',
        filename: storagePath
      });

      // 6. Create new metadata entry
      const key = storagePath.replace(/\//g, '_').replace(/\./g, '_');
      await setDoc({
        collection: 'templates_meta',
        doc: {
          key,
          data: {
            name: finalFilename,
            url: result.downloadUrl,
            size: blob.size,
            uploadedAt: Date.now(),
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            folderId: saveAsFolderId,
            folderPath,
            fullPath
          }
        }
      });

      // 7. Success feedback
      showSuccessToast(t('templateProcessor.saveAsSuccess', { filename: finalFilename }));
      setShowSaveAsDialog(false);
      onClose();

    } catch (error) {
      console.error('Save As failed:', error);
      showErrorToast(t('templateProcessor.saveAsFailed'));
    } finally {
      setSaveAsLoading(false);
    }
  };

  // Enhanced cancel with change detection
  const handleCancel = useCallback(() => {
    console.log('handleCancel called, hasChanges:', hasChanges);
    if (!hasChanges) {
      console.log('No changes, calling onClose');
      onClose();
      return;
    }

    console.log('Has changes, showing dialog');
    setShowUnsavedChangesDialog(true);
  }, [hasChanges, onClose]);

  // Set up navigation request handler for logo clicks
  useEffect(() => {
    // Pass handleCancel directly - the context wrapper handles it properly
    // handleCancel is memoized with useCallback, so it updates when hasChanges changes
    setRequestNavigation(handleCancel);
  }, [setRequestNavigation, handleCancel]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      setRequestNavigation(null);
      setHasUnsavedChanges(false);
    };
  }, [setRequestNavigation, setHasUnsavedChanges]);

  // Form is valid if all required fields have values
  // For now, we consider all fields optional (can be empty)
  const isFormValid = true;

  // Get all field names (both placeholders and custom properties)
  const allFields = [...placeholders, ...Object.keys(customProperties)];

  // Save As Dialog Component
  const SaveAsDialog = () => {
    if (!showSaveAsDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            {t('templateProcessor.saveAsTitle')}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('templateProcessor.saveAsFilename')}
              </label>
              <input
                type="text"
                value={saveAsFilename}
                onChange={(e) => setSaveAsFilename(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('templateProcessor.saveAsFilenamePlaceholder')}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('templateProcessor.saveAsSelectFolder')}
              </label>
              <select
                value={saveAsFolderId || ''}
                onChange={(e) => setSaveAsFolderId(e.target.value || null)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('folders.rootFolder')}</option>
                {folderTree.map((node) => (
                  <>
                    <option key={node.folder.key} value={node.folder.key}>
                      {node.folder.data.name}
                    </option>
                    {node.children.map((child) => (
                      <option key={child.folder.key} value={child.folder.key}>
                        └─ {child.folder.data.name}
                      </option>
                    ))}
                  </>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSaveAsConfirm}
              disabled={!saveAsFilename.trim() || saveAsLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-all"
            >
              {saveAsLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('templateProcessor.saving')}
                </span>
              ) : (
                t('templateProcessor.saveAs')
              )}
            </button>
            <button
              onClick={() => setShowSaveAsDialog(false)}
              disabled={saveAsLoading}
              className="flex-1 bg-slate-500 hover:bg-slate-600 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-all"
            >
              {t('templateProcessor.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Unsaved Changes Dialog Component
  const UnsavedChangesDialog = () => {
    if (!showUnsavedChangesDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            {t('templateProcessor.unsavedChangesTitle')}
          </h3>

          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {t('templateProcessor.unsavedChangesMessage')}
          </p>

          <div className="flex flex-col gap-3">
            {template && (
              <button
                onClick={() => {
                  setShowUnsavedChangesDialog(false);
                  handleSave();
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {t('templateProcessor.unsavedChangesSave')}
              </button>
            )}
            <button
              onClick={() => {
                setShowUnsavedChangesDialog(false);
                handleSaveAs();
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <FilePlus className="w-5 h-5" />
              {t('templateProcessor.unsavedChangesSaveAs')}
            </button>
            <button
              onClick={() => {
                setShowUnsavedChangesDialog(false);
                onClose();
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all"
            >
              {t('templateProcessor.unsavedChangesDiscard')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <SaveAsDialog />
      <UnsavedChangesDialog />
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
          <div className="sticky bottom-0 flex justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 py-4 rounded-b-lg">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">

                {/* Save button - only for saved templates */}
                {template && (
                  <button
                    onClick={handleSave}
                    disabled={!isFormValid || saving || processing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white font-bold py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none whitespace-nowrap"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm sm:text-base">{t('templateProcessor.saving')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Save className="w-5 h-5" />
                        <span className="text-sm sm:text-base">{t('templateProcessor.save')}</span>
                      </span>
                    )}
                  </button>
                )}

                {/* Save As button - always shown */}
                <button
                  onClick={handleSaveAs}
                  disabled={!isFormValid || saving || processing}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white font-bold py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none whitespace-nowrap"
                >
                  <span className="flex items-center justify-center gap-2">
                    <FilePlus className="w-5 h-5" />
                    <span className="text-sm sm:text-base">{t('templateProcessor.saveAs')}</span>
                  </span>
                </button>

                {/* Generate (Download) button */}
                <button
                  onClick={processDocument}
                  disabled={!isFormValid || saving || processing}
                  className="bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none whitespace-nowrap"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm sm:text-base">{t('templateProcessor.processing')}</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Rocket className="w-5 h-5" />
                      <span className="text-sm sm:text-base">{t('templateProcessor.generateDocument')}</span>
                    </span>
                  )}
                </button>

                {/* Cancel button */}
                <button
                  onClick={handleCancel}
                  disabled={saving || processing}
                  className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 disabled:bg-slate-400 text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl whitespace-nowrap"
                >
                  {t('templateProcessor.cancel')}
                </button>
              </div>
          </div>
        )}
    </div>
  );
};
