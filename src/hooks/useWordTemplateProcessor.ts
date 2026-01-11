import { useState, useEffect } from 'react';
import { Doc, uploadFile, setDoc, listDocs, getDoc } from "@junobuild/core";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { WordTemplateData } from "../types/word_template";
import { FolderTreeNode, FolderData } from "../types/folder";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";
import { buildTemplatePath } from "../utils/templatePathUtils";
import { validateFolderName, buildFolderPath } from "../utils/folderUtils";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { useTranslation } from "react-i18next";

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

  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [initialFormData, setInitialFormData] = useState<Record<string, string>>({});
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    extractPlaceholdersAndProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, file]);

  const extractPlaceholdersAndProperties = async () => {
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

      const docCustomProperties = readCustomProperties(zip);
      setCustomProperties(docCustomProperties);

      const documentXml = zip.file("word/document.xml");
      if (!documentXml) {
        throw new Error("Could not find document.xml in the Word file");
      }

      const xmlContent = documentXml.asText();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

      const textRuns = xmlDoc.getElementsByTagName("w:t");
      let reconstructedText = "";

      for (let i = 0; i < textRuns.length; i++) {
        const textNode = textRuns[i];
        reconstructedText += textNode.textContent || "";
      }

      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = reconstructedText.match(placeholderRegex) || [];
      const uniquePlaceholders = [...new Set(matches.map(match => match.slice(2, -2).trim()))];

      setPlaceholders(uniquePlaceholders);

      const initialFormData: Record<string, string> = {};

      uniquePlaceholders.forEach(placeholder => {
        initialFormData[placeholder] = '';
      });

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

  useEffect(() => {
    const changed = Object.keys(formData).some(
      key => formData[key] !== (initialFormData[key] || '')
    );
    setHasChanges(changed);
  }, [formData, initialFormData]);

  const handleInputChange = (placeholder: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [placeholder]: value
    }));
  };

  const generateProcessedBlob = async (): Promise<{ blob: Blob; fileName: string }> => {
    let arrayBuffer: ArrayBuffer;

    if (file) {
      arrayBuffer = await file.arrayBuffer();
    } else if (template?.data.url) {
      const response = await fetch(template.data.url);
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error("No file or template provided");
    }

    const placeholderData: Record<string, string> = {};
    const customPropsData: Record<string, string> = {};

    Object.entries(formData).forEach(([key, value]) => {
      if (key in customProperties) {
        customPropsData[key] = value;
      } else {
        placeholderData[key] = value;
      }
    });

    const fileName = file ? file.name : template?.data.name || 'document.docx';

    try {
      const zip = new PizZip(arrayBuffer);

      if (Object.keys(customPropsData).length > 0) {
        writeCustomProperties(zip, customPropsData);
        updateDocumentFields(zip, customPropsData);
      }

      if (placeholders.length > 0) {
        // Pre-process the document to fix split placeholders before passing to docxtemplater
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

          // Fix specific placeholders that might be split
          placeholders.forEach(placeholder => {
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
      }

      const blob = zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }) as Blob;

      return { blob, fileName };
    } catch (error) {
      console.error('Primary processing failed, trying fallback...', error);

      const zip = new PizZip(arrayBuffer);

      if (Object.keys(customPropsData).length > 0) {
        writeCustomProperties(zip, customPropsData);
        updateDocumentFields(zip, customPropsData);
      }

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
      const { blob, fileName } = await generateProcessedBlob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processed_${fileName}`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccessToast(t('templateProcessor.processSuccess'));
      return true;
    } catch (error) {
      console.error('Error processing document:', error);
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

        const placeholderData: Record<string, string> = {};
        const customPropsData: Record<string, string> = {};

        Object.entries(formData).forEach(([key, value]) => {
          if (key in customProperties) {
            customPropsData[key] = value;
          } else {
            placeholderData[key] = value;
          }
        });

        if (Object.keys(customPropsData).length > 0) {
          writeCustomProperties(zip, customPropsData);
          updateDocumentFields(zip, customPropsData);
        }

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
        return true;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        showErrorToast(t('templateProcessor.processError'));
        return false;
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      const { blob, fileName } = await generateProcessedBlob();

      const storagePath = template.data.fullPath?.startsWith('/')
        ? template.data.fullPath.substring(1)
        : template.data.fullPath || fileName;

      const fileToUpload = new File([blob], fileName, {
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
          ...template,
          data: {
            ...template.data,
            url: result.downloadUrl,
            size: blob.size,
            uploadedAt: Date.now()
          }
        }
      });

      // Reload the template from Juno to get the updated version
      const updatedTemplate = await getDoc<WordTemplateData>({
        collection: 'templates_meta',
        key: template.key
      });

      // Update the template in parent component if callback is provided
      if (updatedTemplate && onTemplateChange) {
        onTemplateChange(updatedTemplate);
      }

      setInitialFormData({ ...formData });
      setHasChanges(false);

      showSuccessToast(t('templateProcessor.saveSuccess'));
      return true;
    } catch (error) {
      console.error('Save failed:', error);
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

      await setDoc({
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

      const existingDocs = await listDocs<WordTemplateData>({
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

      const { blob } = await generateProcessedBlob();

      let folderPath = createdFolderPath;
      if (!folderPath && targetFolderId) {
        const existingFolder = folderTree.find(n => n.folder.key === targetFolderId)?.folder;
        if (existingFolder) {
          folderPath = existingFolder.data.path;
        } else {
          const result = await listDocs({ collection: 'folders' });
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

      const result = await uploadFile({
        data: fileToUpload,
        collection: 'templates',
        filename: storagePath
      });

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
          fullPath
        }
      };

      await setDoc({
        collection: 'templates_meta',
        doc: newTemplateDoc
      });

      if (onTemplateChange) {
        onTemplateChange(newTemplateDoc);
      }

      setInitialFormData({ ...formData });
      setHasChanges(false);

      showSuccessToast(t('templateProcessor.saveAsSuccess', { filename: finalFilename }));
      return true;
    } catch (error) {
      console.error('Save As failed:', error);
      showErrorToast(t('templateProcessor.saveAsFailed'));
      return false;
    }
  };

  const allFields = [...placeholders, ...Object.keys(customProperties)];

  return {
    // State
    placeholders,
    formData,
    customProperties,
    loading,
    processing,
    saving,
    hasChanges,
    allFields,

    // Handlers
    handleInputChange,
    processDocument,
    handleSave,
    handleSaveAs,
  };
};
