import { useState, useEffect, useCallback, useRef } from 'react';
import { Doc } from "@junobuild/core";
import PizZip from "pizzip";
import { WordTemplateData } from "../types/word-template";
import { FolderTreeNode, FolderData } from "../types/folder";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";
import { buildTemplatePath } from "../utils/templatePathUtils";
import { validateFolderName, buildFolderPath } from "../utils/folderUtils";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { fetchWithTimeout, TimeoutError } from "../utils/fetchWithTimeout";
import { extractMetadataFromBlob } from "../utils/extractMetadata";
import { useTranslation } from "react-i18next";
import { useDocumentWorker, ProcessingProgress } from "./useDocumentWorker";
import { uploadFileWithTimeout, setDocWithTimeout, listDocsWithTimeout, getDocWithTimeout } from "../utils/junoWithTimeout";
import { logActivity, computeFileHash } from "../utils/activityLogger";
import { useAuth } from "../contexts/AuthContext";

const FETCH_TIMEOUT = 30000; // 30 seconds for fetching templates

interface UseWordTemplateProcessorProps {
  template?: Doc<WordTemplateData>;
  file?: File;
  folderTree: FolderTreeNode[];
  onTemplateChange?: (newTemplate: Doc<WordTemplateData>) => void;
}

export const useWordTemplateProcessor = ({
  template,
  file,
  folderTree,
  onTemplateChange,
}: UseWordTemplateProcessorProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { processDocument: workerProcessDocument, extractCustomProperties: workerExtractCustomProperties, progress: workerProgress, isWorkerReady } = useDocumentWorker();

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

  // Performance optimization: Batch state updates and incremental change tracking
  const pendingChangesRef = useRef<Record<string, string>>({});
  const flushTimeoutRef = useRef<number | null>(null);
  const changedFieldsRef = useRef<Set<string>>(new Set());
  const initialFormDataRef = useRef<Record<string, string>>({});

  // Sync worker progress to local state
  useEffect(() => {
    setProcessingProgress(workerProgress);
  }, [workerProgress]);

  useEffect(() => {
    // Skip extraction if neither template nor file is provided (e.g., in multi-file mode)
    if (!template && !file) {
      setLoading(false);
      return;
    }
    extractCustomPropertiesFromDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, file]);

  const extractCustomPropertiesFromDocument = async () => {
    try {
      let arrayBuffer: ArrayBuffer;

      if (file) {
        arrayBuffer = await file.arrayBuffer();
      } else if (template?.data.url) {
        try {
          const response = await fetchWithTimeout(template.data.url, { timeout: FETCH_TIMEOUT });
          if (!response.ok) {
            throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        } catch (error) {
          if (error instanceof TimeoutError) {
            showErrorToast(t('errors.timeout'));
            throw error;
          }
          throw error;
        }
      } else {
        throw new Error("No file or template provided");
      }

      // Try to use worker if available, otherwise fall back to synchronous
      if (isWorkerReady) {
        try {
          const { customProperties: docCustomProperties } =
            await workerExtractCustomProperties(arrayBuffer);

          setCustomProperties(docCustomProperties);

          const initialData: Record<string, string> = {};
          Object.entries(docCustomProperties).forEach(([key, value]) => {
            initialData[key] = value;
          });

          // Store in ref for incremental change tracking
          initialFormDataRef.current = initialData;
          changedFieldsRef.current = new Set();

          setFormData(initialData);
          return;
        } catch (workerError) {
          console.warn('Worker extraction failed, falling back to synchronous:', workerError);
          // Re-read the arrayBuffer as it was transferred to the worker and is now detached
          if (file) {
            arrayBuffer = await file.arrayBuffer();
          } else if (template?.data.url) {
            const response = await fetchWithTimeout(template.data.url, { timeout: FETCH_TIMEOUT });
            if (!response.ok) {
              throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
            }
            arrayBuffer = await response.arrayBuffer();
          }
        }
      }

      // Fallback: synchronous extraction
      // Validate that arrayBuffer looks like a ZIP file before attempting to parse
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty or invalid file data received');
      }
      const uint8 = new Uint8Array(arrayBuffer);
      // ZIP files start with "PK" signature (0x50, 0x4B)
      if (uint8.length < 4 || uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
        // Try to decode as text to show what we received
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const preview = decoder.decode(arrayBuffer.slice(0, 200));
        console.error('Invalid file data received. First 200 chars:', preview);
        throw new Error('File does not appear to be a valid DOCX (ZIP) file');
      }
      const zip = new PizZip(arrayBuffer);

      const docCustomProperties = readCustomProperties(zip);
      setCustomProperties(docCustomProperties);

      const initialData: Record<string, string> = {};
      Object.entries(docCustomProperties).forEach(([key, value]) => {
        initialData[key] = value;
      });

      // Store in ref for incremental change tracking
      initialFormDataRef.current = initialData;
      changedFieldsRef.current = new Set();

      setFormData(initialData);
    } catch (error) {
      console.error('Error extracting custom properties:', error);
    } finally {
      setLoading(false);
    }
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

  const generateProcessedBlob = async (skipProcessing: boolean = false): Promise<{ blob: Blob; fileName: string }> => {
    let arrayBuffer: ArrayBuffer;

    if (file) {
      arrayBuffer = await file.arrayBuffer();
    } else if (template?.data.url) {
      const response = await fetchWithTimeout(template.data.url, { timeout: FETCH_TIMEOUT });
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error("No file or template provided");
    }

    const fileName = file ? file.name : template?.data.name || 'document.docx';

    // If no changes were made, return the original file as-is to preserve size and compression
    if (skipProcessing) {
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      return { blob, fileName };
    }

    // All form data is custom properties data
    const customPropsData: Record<string, string> = { ...formData };

    // Try to use worker if available
    if (isWorkerReady) {
      try {
        const blob = await workerProcessDocument(
          arrayBuffer,
          customPropsData
        );
        return { blob, fileName };
      } catch (workerError) {
        console.warn('Worker processing failed, falling back to synchronous:', workerError);
        // Need to re-read the arrayBuffer as it was transferred to the worker
        if (file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (template?.data.url) {
          const response = await fetchWithTimeout(template.data.url, { timeout: FETCH_TIMEOUT });
          if (!response.ok) {
            throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        }
      }
    }

    // Fallback: synchronous processing
    const zip = new PizZip(arrayBuffer);

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

    return { blob, fileName };
  };

  const processDocument = async () => {
    setProcessing(true);
    const startTime = Date.now();
    const fileName = file ? file.name : template?.data.name || 'document.docx';
    const isOneTimeProcessing = !!file && !template;
    
    // Compute file hash for one-time processing (for audit trail)
    let fileHash: { full: string; short: string } | null = null;
    if (isOneTimeProcessing && file) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileHash = await computeFileHash(arrayBuffer);
      } catch (error) {
        console.warn('Failed to compute file hash:', error);
      }
    }

    try {
      const { blob, fileName: processedFileName } = await generateProcessedBlob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processed_${processedFileName}`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Log one-time processing activity
      if (isOneTimeProcessing) {
        const filledFields = Object.keys(formData).filter(key => formData[key] && formData[key].trim() !== '');
        const processingDuration = Date.now() - startTime;
        
        await logActivity({
          action: 'processed_onetime',
          resource_type: 'onetime_file',
          resource_id: fileHash?.short || `onetime_${Date.now()}`,
          resource_name: fileName,
          created_by: user?.key || 'anonymous',
          modified_by: user?.key || 'anonymous',
          success: true,
          file_size: file?.size,
          file_hash: fileHash?.full,
          fields_filled: filledFields,
          processing_duration_ms: processingDuration,
          custom_properties_count: Object.keys(customProperties).length,
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      }

      showSuccessToast(t('templateProcessor.processSuccess'));
      return true;
    } catch (error) {
      console.error('Error processing document:', error);
      
      // Log failed one-time processing
      if (isOneTimeProcessing) {
        const processingDuration = Date.now() - startTime;
        
        await logActivity({
          action: 'processed_onetime',
          resource_type: 'onetime_file',
          resource_id: fileHash?.short || `onetime_${Date.now()}`,
          resource_name: fileName,
          created_by: user?.key || 'anonymous',
          modified_by: user?.key || 'anonymous',
          success: false,
          file_size: file?.size,
          file_hash: fileHash?.full,
          processing_duration_ms: processingDuration,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      }
      
      showErrorToast(t('templateProcessor.processError'));
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      // Skip processing if no changes were made - preserves original file size and compression
      const { blob, fileName } = await generateProcessedBlob(!hasChanges);

      const storagePath = template.data.fullPath?.startsWith('/')
        ? template.data.fullPath.substring(1)
        : template.data.fullPath || fileName;

      const fileToUpload = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const result = await uploadFileWithTimeout({
        data: fileToUpload,
        collection: 'templates',
        filename: storagePath
      });

      // Extract metadata from the blob to update custom property count
      const { customPropertyCount } = await extractMetadataFromBlob(blob);

      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: {
          ...template,
          data: {
            ...template.data,
            url: result.downloadUrl,
            size: blob.size,
            uploadedAt: Date.now(),
            customPropertyCount
          }
        }
      });

      // Reload the template from Juno to get the updated version
      const updatedTemplate = await getDocWithTimeout<WordTemplateData>({
        collection: 'templates_meta',
        key: template.key
      });

      // Update the template in parent component if callback is provided
      if (updatedTemplate && onTemplateChange) {
        onTemplateChange(updatedTemplate);
      }

      // Update initial form data and reset change tracking refs
      initialFormDataRef.current = { ...formData };
      changedFieldsRef.current = new Set();
      setHasChanges(false);

      // Log successful template update
      await logActivity({
        action: 'updated',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: true,
        file_size: blob.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });

      showSuccessToast(t('templateProcessor.saveSuccess'));
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      
      // Log failed template update
      await logActivity({
        action: 'updated',
        resource_type: 'template',
        resource_id: template.key,
        resource_name: template.data.name,
        created_by: template.owner || 'unknown',
        modified_by: user?.key || template.owner || 'unknown',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        file_size: template.data.size,
        folder_path: template.data.folderPath,
        mime_type: template.data.mimeType,
      });
      
      showErrorToast(t('templateProcessor.saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createNewFolder = async (folderName: string, parentId: string | null): Promise<string | null> => {
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      showErrorToast(t('folders.enterFolderName') || 'Please enter a folder name');
      return null;
    }

    const validationError = await validateFolderName(trimmedName, parentId);
    if (validationError) {
      showErrorToast(validationError);
      return null;
    }

    let parentFolder = null;
    if (parentId) {
      parentFolder = folderTree.find(n => n.folder.key === parentId)?.folder;
      if (parentFolder && parentFolder.data.level >= 1) {
        showErrorToast(t('folders.maxDepthReached') || 'Maximum folder depth reached');
        return null;
      }
    }

    const level = parentFolder ? parentFolder.data.level + 1 : 0;
    const path = buildFolderPath(trimmedName, parentFolder?.data.path || null);

    try {
      const key = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      await setDocWithTimeout({
        collection: 'folders',
        doc: {
          key,
          data: {
            name: trimmedName,
            parentId,
            path,
            level,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            order: 0,
          } as FolderData,
        },
      });

      showSuccessToast(t('folders.folderCreated', { name: trimmedName }) || `Folder "${trimmedName}" created`);
      return key;
    } catch (err) {
      console.error('Failed to create folder:', err);
      showErrorToast(t('folders.createFailed') || 'Failed to create folder');
      return null;
    }
  };

  const handleSaveAs = async (
    filename: string,
    folderId: string | null,
    newFolderData?: { name: string; parentId: string | null }
  ) => {
    setSaving(true);
    try {
      let targetFolderId = folderId;
      let createdFolderPath = '';

      if (newFolderData) {
        const newFolderId = await createNewFolder(newFolderData.name, newFolderData.parentId);
        if (!newFolderId) {
          return false;
        }
        targetFolderId = newFolderId;

        const parentFolder = newFolderData.parentId
          ? folderTree.find(n => n.folder.key === newFolderData.parentId)?.folder
          : null;
        createdFolderPath = buildFolderPath(newFolderData.name.trim(), parentFolder?.data.path || null);
      }

      const trimmedFilename = filename.trim();
      if (!trimmedFilename) {
        showErrorToast(t('templateProcessor.saveAsInvalidFilename'));
        return false;
      }

      const finalFilename = trimmedFilename.endsWith('.docx')
        ? trimmedFilename
        : `${trimmedFilename}.docx`;

      const existingDocs = await listDocsWithTimeout<WordTemplateData>({
        collection: 'templates_meta',
        filter: {}
      });

      const fileExists = existingDocs.items.some(doc =>
        doc.data.name === finalFilename &&
        (doc.data.folderId || null) === targetFolderId
      );

      if (fileExists) {
        showErrorToast(t('templateProcessor.saveAsFileExists'));
        return false;
      }

      // Skip processing if no changes were made - preserves original file size and compression
      const { blob } = await generateProcessedBlob(!hasChanges);

      let folderPath = createdFolderPath;
      if (!folderPath && targetFolderId) {
        const existingFolder = folderTree.find(n => n.folder.key === targetFolderId)?.folder;
        if (existingFolder) {
          folderPath = existingFolder.data.path;
        } else {
          const result = await listDocsWithTimeout({ collection: 'folders' });
          const targetFolder = result.items.find((f) => f.key === targetFolderId);
          if (targetFolder && targetFolder.data && typeof targetFolder.data === 'object' && 'path' in targetFolder.data) {
            folderPath = (targetFolder.data as { path: string }).path;
          }
        }
      }

      const fullPath = buildTemplatePath(folderPath, finalFilename);
      const storagePath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

      const fileToUpload = new File([blob], finalFilename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const result = await uploadFileWithTimeout({
        data: fileToUpload,
        collection: 'templates',
        filename: storagePath
      });

      // Extract metadata from the blob to store custom property count
      const { customPropertyCount } = await extractMetadataFromBlob(blob);

      const key = storagePath.replace(/\//g, '_').replace(/\./g, '_');
      const newTemplateDoc: Doc<WordTemplateData> = {
        key,
        data: {
          name: finalFilename,
          url: result.downloadUrl,
          size: blob.size,
          uploadedAt: Date.now(),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          folderId: targetFolderId,
          folderPath,
          fullPath,
          customPropertyCount
        }
      };

      await setDocWithTimeout({
        collection: 'templates_meta',
        doc: newTemplateDoc
      });

      if (onTemplateChange) {
        onTemplateChange(newTemplateDoc);
      }

      // Update initial form data and reset change tracking refs
      initialFormDataRef.current = { ...formData };
      changedFieldsRef.current = new Set();
      setHasChanges(false);

      showSuccessToast(t('templateProcessor.saveAsSuccess', { filename: finalFilename }));
      return true;
    } catch (error) {
      console.error('Save As failed:', error);
      showErrorToast(t('templateProcessor.saveAsFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const allFields = Object.keys(customProperties);

  return {
    // State
    formData,
    customProperties,
    loading,
    processing,
    saving,
    hasChanges,
    allFields,
    processingProgress,

    // Handlers
    handleInputChange,
    processDocument,
    handleSave,
    handleSaveAs,
  };
};
