import { useState, useEffect, useCallback } from 'react';
import { Doc, uploadFile, setDoc, getDoc } from "@junobuild/core";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { WordTemplateData } from "../types/word_template";
import { ProcessingTemplate, MultiFileFieldData, ProcessedDocumentResult } from "../types/multi-processing";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { ProcessingProgress } from "./useDocumentWorker";

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
    isCustomProperty: {},
  });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [initialFormData, setInitialFormData] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

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

  const extractPlaceholdersFromBuffer = async (arrayBuffer: ArrayBuffer): Promise<{
    placeholders: string[];
    customProperties: Record<string, string>;
  }> => {
    const zip = new PizZip(arrayBuffer);
    const docCustomProperties = readCustomProperties(zip);

    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      return { placeholders: [], customProperties: docCustomProperties };
    }

    const xmlContent = documentXml.asText();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

    const textRuns = xmlDoc.getElementsByTagName("w:t");
    let reconstructedText = "";

    for (let i = 0; i < textRuns.length; i++) {
      reconstructedText += textRuns[i].textContent || "";
    }

    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = reconstructedText.match(placeholderRegex) || [];
    const uniquePlaceholders = [...new Set(matches.map(match => match.slice(2, -2).trim()))];

    return { placeholders: uniquePlaceholders, customProperties: docCustomProperties };
  };

  const extractAllPlaceholdersAndProperties = async () => {
    setLoading(true);
    try {
      const extractedTemplates: ProcessingTemplate[] = [];

      // Process saved templates
      for (const template of templates) {
        try {
          if (!template.data.url) continue;

          const response = await fetch(template.data.url);
          const arrayBuffer = await response.arrayBuffer();
          const { placeholders, customProperties } = await extractPlaceholdersFromBuffer(arrayBuffer);

          extractedTemplates.push({
            id: template.key,
            template,
            fileName: template.data.name,
            placeholders,
            customProperties,
          });
        } catch (error) {
          console.error(`Failed to extract from template ${template.data.name}:`, error);
        }
      }

      // Process one-time files
      for (const file of files) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const { placeholders, customProperties } = await extractPlaceholdersFromBuffer(arrayBuffer);

          extractedTemplates.push({
            id: file.name,
            file,
            fileName: file.name,
            placeholders,
            customProperties,
          });
        } catch (error) {
          console.error(`Failed to extract from file ${file.name}:`, error);
        }
      }

      setProcessingTemplates(extractedTemplates);

      // Categorize fields
      const categorizedFields = categorizeFields(extractedTemplates);
      setFieldData(categorizedFields);

      // Initialize form data
      const initial: Record<string, string> = {};

      // Add all fields (shared + unique) with empty values or existing custom property values
      const allFieldNames = new Set<string>();
      extractedTemplates.forEach(pt => {
        pt.placeholders.forEach(p => allFieldNames.add(p));
        Object.keys(pt.customProperties).forEach(k => allFieldNames.add(k));
      });

      allFieldNames.forEach(fieldName => {
        // Check if any template has a value for this custom property
        const templateWithValue = extractedTemplates.find(
          pt => pt.customProperties[fieldName] !== undefined && pt.customProperties[fieldName] !== ''
        );
        initial[fieldName] = templateWithValue?.customProperties[fieldName] || '';
      });

      setInitialFormData(initial);
      setFormData(initial);
    } catch (error) {
      console.error('Error extracting placeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeFields = (extractedTemplates: ProcessingTemplate[]): MultiFileFieldData => {
    const fieldToFiles = new Map<string, string[]>();
    const isCustomProperty: Record<string, boolean> = {};

    // Build field-to-files mapping
    extractedTemplates.forEach(pt => {
      // Process placeholders
      pt.placeholders.forEach(placeholder => {
        const files = fieldToFiles.get(placeholder) || [];
        files.push(pt.id);
        fieldToFiles.set(placeholder, files);
        isCustomProperty[placeholder] = false;
      });

      // Process custom properties
      Object.keys(pt.customProperties).forEach(propName => {
        const files = fieldToFiles.get(propName) || [];
        if (!files.includes(pt.id)) {
          files.push(pt.id);
        }
        fieldToFiles.set(propName, files);
        isCustomProperty[propName] = true;
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
      isCustomProperty,
    };
  };

  // Track changes
  useEffect(() => {
    const changed = Object.keys(formData).some(
      key => formData[key] !== (initialFormData[key] || '')
    );
    setHasChanges(changed);
  }, [formData, initialFormData]);

  const handleInputChange = useCallback((fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  const generateProcessedBlob = async (pt: ProcessingTemplate, currentFormData: Record<string, string>): Promise<Blob> => {
    let arrayBuffer: ArrayBuffer;

    if (pt.file) {
      arrayBuffer = await pt.file.arrayBuffer();
    } else if (pt.template?.data.url) {
      const response = await fetch(pt.template.data.url);
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error(`No file or template URL for ${pt.fileName}`);
    }

    const zip = new PizZip(arrayBuffer);

    // Determine which fields belong to this file
    const relevantFields = new Set<string>();
    pt.placeholders.forEach(p => relevantFields.add(p));
    Object.keys(pt.customProperties).forEach(k => relevantFields.add(k));

    // Split form data for this file
    const placeholderData: Record<string, string> = {};
    const customPropsData: Record<string, string> = {};

    relevantFields.forEach(fieldName => {
      const value = currentFormData[fieldName] || '';
      if (fieldName in pt.customProperties) {
        customPropsData[fieldName] = value;
      } else {
        placeholderData[fieldName] = value;
      }
    });

    // Update custom properties
    if (Object.keys(customPropsData).length > 0) {
      writeCustomProperties(zip, customPropsData);
      updateDocumentFields(zip, customPropsData);
    }

    // Process placeholders
    let outputZip = zip;
    if (pt.placeholders.length > 0) {
      // Pre-process the document to fix split placeholders
      const documentXml = zip.file("word/document.xml");
      if (documentXml) {
        let xmlContent = documentXml.asText();

        // Fix split placeholder patterns
        xmlContent = xmlContent.replace(
          /(<w:t[^>]*>)([^<]*\{+[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*[}]+[^<]*?)(<\/w:t>)/g,
          '$1$2$3$4'
        );

        xmlContent = xmlContent.replace(
          /(<w:t[^>]*>)([^<]*\{\{[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*}}[^<]*?)(<\/w:t>)/g,
          '$1$2$3$4'
        );

        // Fix specific placeholders
        pt.placeholders.forEach(placeholder => {
          const parts = placeholder.split('');
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

        zip.file("word/document.xml", xmlContent);
      }

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ""
      });

      doc.setData(placeholderData);
      doc.render();

      // Get the modified zip from docxtemplater
      outputZip = doc.getZip();
    }

    const blob = outputZip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }) as Blob;

    return blob;
  };

  const processAllDocuments = async (): Promise<boolean> => {
    setProcessing(true);
    try {
      const results: ProcessedDocumentResult[] = [];

      for (let i = 0; i < processingTemplates.length; i++) {
        const pt = processingTemplates[i];
        setProcessingProgress({
          stage: 'generating',
          progress: Math.round(((i + 1) / processingTemplates.length) * 100),
        });

        try {
          // Pass formData directly to avoid stale closure issues
          const blob = await generateProcessedBlob(pt, formData);
          results.push({
            id: pt.id,
            fileName: pt.fileName,
            blob,
          });
        } catch (error) {
          console.error(`Failed to process ${pt.fileName}:`, error);
          showErrorToast(t('templateProcessor.processErrorFile', { filename: pt.fileName }));
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

      if (results.length > 0) {
        showSuccessToast(t('templateProcessor.multiProcessSuccess', { count: results.length }));
      }

      return results.length === processingTemplates.length;
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

  const saveAllDocuments = async (): Promise<boolean> => {
    if (savableTemplates.length === 0) {
      showErrorToast(t('templateProcessor.noTemplatesToSave'));
      return false;
    }

    setSaving(true);
    let savedCount = 0;

    try {
      for (let i = 0; i < savableTemplates.length; i++) {
        const pt = savableTemplates[i];
        if (!pt.template) continue;

        setProcessingProgress({
          stage: 'generating',
          progress: Math.round(((i + 1) / savableTemplates.length) * 100),
        });

        try {
          const blob = await generateProcessedBlob(pt, formData);

          const storagePath = pt.template.data.fullPath?.startsWith('/')
            ? pt.template.data.fullPath.substring(1)
            : pt.template.data.fullPath || pt.fileName;

          const fileToUpload = new File([blob], pt.fileName, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });

          const result = await uploadFile({
            data: fileToUpload,
            collection: 'templates',
            filename: storagePath
          });

          await setDoc({
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

          savedCount++;
        } catch (error) {
          console.error(`Failed to save ${pt.fileName}:`, error);
          showErrorToast(t('templateProcessor.saveErrorFile', { filename: pt.fileName }));
        }
      }

      if (savedCount > 0) {
        // Update initial form data to reflect saved state
        setInitialFormData({ ...formData });
        setHasChanges(false);
        showSuccessToast(t('templateProcessor.multiSaveSuccess', { count: savedCount }));
      }

      return savedCount === savableTemplates.length;
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

    // Handlers
    handleInputChange,
    processAllDocuments,
    saveAllDocuments,
  };
};
