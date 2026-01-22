import { useState, useEffect, useCallback, useRef } from 'react';
import { Doc } from "@junobuild/core";
import PizZip from "pizzip";
import { WordTemplateData } from "../types/word-template";
import { ProcessingTemplate, MultiFileFieldData, ProcessedDocumentResult, FileStatusInfo } from "../types/multi-processing";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { fetchWithTimeout, TimeoutError } from "../utils/fetchWithTimeout";
import { useTranslation } from "react-i18next";
import { ProcessingProgress } from "./useDocumentWorker";
import { uploadFileWithTimeout, setDocWithTimeout, getDocWithTimeout } from "../utils/junoWithTimeout";

const FETCH_TIMEOUT = 30000; // 30 seconds for fetching templates

interface UseMultiFileProcessorProps {
  templates: Doc<WordTemplateData>[];
  files?: File[];
}

export const useMultiFileProcessor = ({
  templates,
  files = [],
}: UseMultiFileProcessorProps) => {
  const { t } = useTranslation();

  // State for extracted data from all files
  const [processingTemplates, setProcessingTemplates] = useState<ProcessingTemplate[]>([]);
  const [fieldData, setFieldData] = useState<MultiFileFieldData>({
    sharedFields: [],
    fileFields: new Map(),
    fieldToFiles: new Map(),
  });
  const [formData, setFormData] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

  // Per-file status tracking for batch error reporting
  const [fileStatuses, setFileStatuses] = useState<FileStatusInfo[]>([]);

  // Performance optimization: Batch state updates and incremental change tracking
  const pendingChangesRef = useRef<Record<string, string>>({});
  const flushTimeoutRef = useRef<number | null>(null);
  const changedFieldsRef = useRef<Set<string>>(new Set());
  const initialFormDataRef = useRef<Record<string, string>>({});

  // Create stable keys to prevent infinite re-renders from array reference changes
  const templateKeys = templates.map(t => t.key).join(',');
  const fileNames = files.map(f => f.name).join(',');

  // Extract placeholders and properties from all files
  useEffect(() => {
    // Skip if no templates or files to process
    if (!templateKeys && !fileNames) {
      setLoading(false);
      return;
    }
    extractAllPlaceholdersAndProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKeys, fileNames]);

  const extractCustomPropertiesFromBuffer = async (arrayBuffer: ArrayBuffer): Promise<{
    customProperties: Record<string, string>;
  }> => {
    const zip = new PizZip(arrayBuffer);
    const docCustomProperties = readCustomProperties(zip);
    return { customProperties: docCustomProperties };
  };

  const extractAllPlaceholdersAndProperties = async () => {
    setLoading(true);
    try {
      // PERFORMANCE: Extract all files in parallel instead of sequential
      const templateTasks = templates.map(async (template): Promise<ProcessingTemplate | null> => {
        try {
          if (!template.data.url) return null;

          const response = await fetchWithTimeout(template.data.url, { timeout: FETCH_TIMEOUT });
          if (!response.ok) {
            throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const { customProperties } = await extractCustomPropertiesFromBuffer(arrayBuffer);

          return {
            id: template.key,
            template,
            fileName: template.data.name,
            customProperties,
          };
        } catch (error) {
          if (error instanceof TimeoutError) {
            console.error(`Timeout fetching template ${template.data.name}`);
          } else {
            console.error(`Failed to extract from template ${template.data.name}:`, error);
          }
          return null;
        }
      });

      const fileTasks = files.map(async (file): Promise<ProcessingTemplate | null> => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const { customProperties } = await extractCustomPropertiesFromBuffer(arrayBuffer);

          return {
            id: file.name,
            file,
            fileName: file.name,
            customProperties,
          };
        } catch (error) {
          console.error(`Failed to extract from file ${file.name}:`, error);
          return null;
        }
      });

      // Run all extractions in parallel (browser naturally limits concurrent fetches)
      const results = await Promise.all([...templateTasks, ...fileTasks]);
      const extractedTemplates = results.filter((pt): pt is ProcessingTemplate => pt !== null);

      setProcessingTemplates(extractedTemplates);

      // Categorize fields
      const categorizedFields = categorizeFields(extractedTemplates);
      setFieldData(categorizedFields);

      // Initialize form data
      const initial: Record<string, string> = {};

      // Add all custom property fields with existing values
      const allFieldNames = new Set<string>();
      extractedTemplates.forEach(pt => {
        Object.keys(pt.customProperties).forEach(k => allFieldNames.add(k));
      });

      allFieldNames.forEach(fieldName => {
        // Check if any template has a value for this custom property
        const templateWithValue = extractedTemplates.find(
          pt => pt.customProperties[fieldName] !== undefined && pt.customProperties[fieldName] !== ''
        );
        initial[fieldName] = templateWithValue?.customProperties[fieldName] || '';
      });

      // Store in ref for incremental change tracking
      initialFormDataRef.current = initial;
      changedFieldsRef.current = new Set();

      setFormData(initial);
    } catch (error) {
      console.error('Error extracting placeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeFields = (extractedTemplates: ProcessingTemplate[]): MultiFileFieldData => {
    const fieldToFiles = new Map<string, string[]>();

    // Build field-to-files mapping (all fields are custom properties now)
    extractedTemplates.forEach(pt => {
      Object.keys(pt.customProperties).forEach(propName => {
        const files = fieldToFiles.get(propName) || [];
        if (!files.includes(pt.id)) {
          files.push(pt.id);
        }
        fieldToFiles.set(propName, files);
      });
    });

    // Categorize into shared vs unique
    const sharedFields: string[] = [];
    const fileFields = new Map<string, { fileName: string; fields: string[] }>();

    // Initialize file fields map
    extractedTemplates.forEach(pt => {
      fileFields.set(pt.id, { fileName: pt.fileName, fields: [] });
    });

    fieldToFiles.forEach((fileIds, fieldName) => {
      if (fileIds.length > 1) {
        // Field appears in multiple files - it's shared
        sharedFields.push(fieldName);
      } else {
        // Field appears in only one file - it's unique
        const fileId = fileIds[0];
        const fileInfo = fileFields.get(fileId);
        if (fileInfo) {
          fileInfo.fields.push(fieldName);
        }
      }
    });

    return {
      sharedFields,
      fileFields,
      fieldToFiles,
    };
  };

  // PERFORMANCE: Optimized handleInputChange with batched updates and incremental change tracking
  const handleInputChange = useCallback((fieldName: string, value: string) => {
    // Track which fields have changed (O(1) instead of O(n) change detection)
    const initialValue = initialFormDataRef.current[fieldName] || '';
    if (value !== initialValue) {
      changedFieldsRef.current.add(fieldName);
    } else {
      changedFieldsRef.current.delete(fieldName);
    }

    // Update hasChanges immediately (O(1) check)
    setHasChanges(changedFieldsRef.current.size > 0);

    // Batch state updates to reduce re-renders
    pendingChangesRef.current[fieldName] = value;

    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    // Flush batched changes after 100ms of inactivity
    flushTimeoutRef.current = window.setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        ...pendingChangesRef.current
      }));
      pendingChangesRef.current = {};
    }, 100);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  const generateProcessedBlob = async (pt: ProcessingTemplate, currentFormData: Record<string, string>): Promise<Blob> => {
    let arrayBuffer: ArrayBuffer;

    if (pt.file) {
      arrayBuffer = await pt.file.arrayBuffer();
    } else if (pt.template?.data.url) {
      const response = await fetchWithTimeout(pt.template.data.url, { timeout: FETCH_TIMEOUT });
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error(`No file or template URL for ${pt.fileName}`);
    }

    const zip = new PizZip(arrayBuffer);

    // Build custom properties data for this file
    const customPropsData: Record<string, string> = {};
    Object.keys(pt.customProperties).forEach(fieldName => {
      customPropsData[fieldName] = currentFormData[fieldName] || '';
    });

    // Update custom properties
    if (Object.keys(customPropsData).length > 0) {
      writeCustomProperties(zip, customPropsData);
      updateDocumentFields(zip, customPropsData);
    }

    const blob = zip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }) as Blob;

    return blob;
  };

  const processAllDocuments = async (retryFileIds?: string[]): Promise<boolean> => {
    setProcessing(true);

    // Determine which templates to process (all or only retry ones)
    const templatesToProcess = retryFileIds
      ? processingTemplates.filter(pt => retryFileIds.includes(pt.id))
      : processingTemplates;

    // Initialize file statuses
    const initialStatuses: FileStatusInfo[] = templatesToProcess.map(pt => ({
      id: pt.id,
      fileName: pt.fileName,
      status: 'pending' as const,
    }));

    // If retrying, merge with existing statuses (keep success ones)
    if (retryFileIds) {
      setFileStatuses(prev => {
        const successStatuses = prev.filter(s => s.status === 'success' && !retryFileIds.includes(s.id));
        return [...successStatuses, ...initialStatuses];
      });
    } else {
      setFileStatuses(initialStatuses);
    }

    try {
      const results: ProcessedDocumentResult[] = [];
      const errors: { id: string; fileName: string; error: string }[] = [];

      for (let i = 0; i < templatesToProcess.length; i++) {
        const pt = templatesToProcess[i];

        // Update status to processing
        setFileStatuses(prev => prev.map(s =>
          s.id === pt.id ? { ...s, status: 'processing' as const } : s
        ));

        setProcessingProgress({
          stage: 'generating',
          progress: Math.round(((i + 1) / templatesToProcess.length) * 100),
        });

        try {
          // Pass formData directly to avoid stale closure issues
          const blob = await generateProcessedBlob(pt, formData);
          results.push({
            id: pt.id,
            fileName: pt.fileName,
            blob,
          });

          // Update status to success
          setFileStatuses(prev => prev.map(s =>
            s.id === pt.id ? { ...s, status: 'success' as const } : s
          ));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to process ${pt.fileName}:`, error);

          // Update status to error with message
          setFileStatuses(prev => prev.map(s =>
            s.id === pt.id
              ? { ...s, status: 'error' as const, error: errorMessage, retryCount: (s.retryCount || 0) + 1 }
              : s
          ));

          errors.push({ id: pt.id, fileName: pt.fileName, error: errorMessage });
        }
      }

      // Download all processed files
      for (const result of results) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName;
        a.click();
        window.URL.revokeObjectURL(url);

        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Show appropriate toast messages
      if (results.length > 0 && errors.length === 0) {
        showSuccessToast(t('templateProcessor.multiProcessSuccess', { count: results.length }));
      } else if (results.length > 0 && errors.length > 0) {
        showSuccessToast(t('templateProcessor.multiProcessPartial', { success: results.length, failed: errors.length }));
      } else if (errors.length > 0) {
        showErrorToast(t('templateProcessor.multiProcessFailed', { count: errors.length }));
      }

      return errors.length === 0;
    } catch (error) {
      console.error('Error processing documents:', error);
      showErrorToast(t('templateProcessor.processError'));
      return false;
    } finally {
      setProcessing(false);
      setProcessingProgress(null);
    }
  };

  // Get templates that can be saved (those with template data, not one-time files)
  const savableTemplates = processingTemplates.filter(pt => pt.template);

  const saveAllDocuments = async (retryFileIds?: string[]): Promise<boolean> => {
    if (savableTemplates.length === 0) {
      showErrorToast(t('templateProcessor.noTemplatesToSave'));
      return false;
    }

    setSaving(true);

    // Determine which templates to save (all or only retry ones)
    const templatesToSave = retryFileIds
      ? savableTemplates.filter(pt => retryFileIds.includes(pt.id))
      : savableTemplates;

    // Initialize file statuses for saving
    const initialStatuses: FileStatusInfo[] = templatesToSave.map(pt => ({
      id: pt.id,
      fileName: pt.fileName,
      status: 'pending' as const,
    }));

    if (retryFileIds) {
      setFileStatuses(prev => {
        const successStatuses = prev.filter(s => s.status === 'success' && !retryFileIds.includes(s.id));
        return [...successStatuses, ...initialStatuses];
      });
    } else {
      setFileStatuses(initialStatuses);
    }

    const errors: { id: string; fileName: string; error: string }[] = [];
    let savedCount = 0;

    try {
      for (let i = 0; i < templatesToSave.length; i++) {
        const pt = templatesToSave[i];
        if (!pt.template) continue;

        // Update status to processing
        setFileStatuses(prev => prev.map(s =>
          s.id === pt.id ? { ...s, status: 'processing' as const } : s
        ));

        setProcessingProgress({
          stage: 'generating',
          progress: Math.round(((i + 1) / templatesToSave.length) * 100),
        });

        try {
          const blob = await generateProcessedBlob(pt, formData);

          const storagePath = pt.template.data.fullPath?.startsWith('/')
            ? pt.template.data.fullPath.substring(1)
            : pt.template.data.fullPath || pt.fileName;

          const fileToUpload = new File([blob], pt.fileName, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });

          const result = await uploadFileWithTimeout({
            data: fileToUpload,
            collection: 'templates',
            filename: storagePath
          });

          await setDocWithTimeout({
            collection: 'templates_meta',
            doc: {
              ...pt.template,
              data: {
                ...pt.template.data,
                url: result.downloadUrl,
                size: blob.size,
                uploadedAt: Date.now()
              }
            }
          });

          // Fetch the updated template to get the new version
          const updatedTemplate = await getDocWithTimeout<WordTemplateData>({
            collection: 'templates_meta',
            key: pt.template.key
          });

          // Update processingTemplates with the new template version
          if (updatedTemplate) {
            setProcessingTemplates(prev => prev.map(p =>
              p.id === pt.id ? { ...p, template: updatedTemplate } : p
            ));
          }

          savedCount++;

          // Update status to success
          setFileStatuses(prev => prev.map(s =>
            s.id === pt.id ? { ...s, status: 'success' as const } : s
          ));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to save ${pt.fileName}:`, error);

          // Update status to error
          setFileStatuses(prev => prev.map(s =>
            s.id === pt.id
              ? { ...s, status: 'error' as const, error: errorMessage, retryCount: (s.retryCount || 0) + 1 }
              : s
          ));

          errors.push({ id: pt.id, fileName: pt.fileName, error: errorMessage });
        }
      }

      if (savedCount > 0) {
        // Update initial form data to reflect saved state
        initialFormDataRef.current = { ...formData };
        changedFieldsRef.current = new Set();
        setHasChanges(false);

        if (errors.length === 0) {
          showSuccessToast(t('templateProcessor.multiSaveSuccess', { count: savedCount }));
        } else {
          showSuccessToast(t('templateProcessor.multiSavePartial', { success: savedCount, failed: errors.length }));
        }
      } else if (errors.length > 0) {
        showErrorToast(t('templateProcessor.multiSaveFailed', { count: errors.length }));
      }

      return errors.length === 0;
    } catch (error) {
      console.error('Error saving documents:', error);
      showErrorToast(t('templateProcessor.saveFailed'));
      return false;
    } finally {
      setSaving(false);
      setProcessingProgress(null);
    }
  };

  const saveAllDocumentsAs = async (
    modifierType: 'prefix' | 'suffix',
    modifierValue: string,
    folderId: string | null,
    folderPath: string,
    _newFolderData?: { name: string; parentId: string | null }
  ): Promise<boolean> => {
    setSaving(true);
    let savedCount = 0;

    try {
      for (let i = 0; i < processingTemplates.length; i++) {
        const pt = processingTemplates[i];

        setProcessingProgress({
          stage: 'generating',
          progress: Math.round(((i + 1) / processingTemplates.length) * 100),
        });

        try {
          const blob = await generateProcessedBlob(pt, formData);

          // Generate new filename with prefix/suffix
          const nameWithoutExt = pt.fileName.replace(/\.docx$/i, '');
          const newFileName = modifierType === 'prefix'
            ? `${modifierValue}${nameWithoutExt}.docx`
            : `${nameWithoutExt}${modifierValue}.docx`;

          // Build the storage path
          const fullPath = folderPath ? `${folderPath}/${newFileName}` : newFileName;
          const storagePath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

          const fileToUpload = new File([blob], newFileName, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });

          const result = await uploadFileWithTimeout({
            data: fileToUpload,
            collection: 'templates',
            filename: storagePath
          });

          // Create new metadata document
          const newDocKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await setDocWithTimeout({
            collection: 'templates_meta',
            doc: {
              key: newDocKey,
              data: {
                name: newFileName,
                url: result.downloadUrl,
                size: blob.size,
                uploadedAt: Date.now(),
                folderId: folderId,
                folderPath: folderPath,
                fullPath: fullPath,
              }
            }
          });

          savedCount++;
        } catch (error) {
          console.error(`Failed to save ${pt.fileName}:`, error);
          showErrorToast(t('templateProcessor.saveErrorFile', { filename: pt.fileName }));
        }
      }

      if (savedCount > 0) {
        showSuccessToast(t('templateProcessor.multiSaveAsSuccess', { count: savedCount }));
      }

      return savedCount === processingTemplates.length;
    } catch (error) {
      console.error('Error saving documents:', error);
      showErrorToast(t('templateProcessor.saveFailed'));
      return false;
    } finally {
      setSaving(false);
      setProcessingProgress(null);
    }
  };

  // Get all fields for display
  const allFields = [
    ...fieldData.sharedFields,
    ...Array.from(fieldData.fileFields.values()).flatMap(f => f.fields)
  ];

  // Helper to get IDs of failed files for retry
  const getFailedFileIds = useCallback(() => {
    return fileStatuses.filter(s => s.status === 'error').map(s => s.id);
  }, [fileStatuses]);

  // Helper to check if there are any failed files
  const hasFailedFiles = fileStatuses.some(s => s.status === 'error');

  // Helper to clear file statuses (e.g., when closing error panel)
  const clearFileStatuses = useCallback(() => {
    setFileStatuses([]);
  }, []);

  return {
    // State
    processingTemplates,
    fieldData,
    formData,
    loading,
    processing,
    saving,
    hasChanges,
    allFields,
    processingProgress,
    savableTemplates,
    fileStatuses,
    hasFailedFiles,

    // Handlers
    handleInputChange,
    processAllDocuments,
    saveAllDocuments,
    saveAllDocumentsAs,
    getFailedFileIds,
    clearFileStatuses,
  };
};
