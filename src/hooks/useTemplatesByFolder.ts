import { useState, useCallback, useEffect } from 'react';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../types/word-template';
import { listDocsWithTimeout } from '../utils/junoWithTimeout';

export const useTemplatesByFolder = (selectedFolderId: string | null) => {
  const [templates, setTemplates] = useState<Doc<WordTemplateData>[]>([]);
  const [allTemplates, setAllTemplates] = useState<Doc<WordTemplateData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all templates
  const loadAllTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDocsWithTimeout({ collection: 'templates_meta' });
      const templateList = result.items as Doc<WordTemplateData>[];
      setAllTemplates(templateList);
      return templateList;
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter templates by folder (only direct files, not subfolders)
  const filterTemplatesByFolder = useCallback(
    (templateList: Doc<WordTemplateData>[], folderId: string | null) => {
      return templateList.filter((template) => {
        const templateFolderId = template.data.folderId ?? null;
        return templateFolderId === folderId;
      });
    },
    []
  );

  // Load and filter templates when folder changes
  useEffect(() => {
    const loadAndFilter = async () => {
      const templateList = await loadAllTemplates();
      const filtered = filterTemplatesByFolder(templateList, selectedFolderId);
      setTemplates(filtered);
    };

    loadAndFilter();
  }, [selectedFolderId, loadAllTemplates, filterTemplatesByFolder]);

  // Refresh templates
  const refresh = useCallback(async () => {
    const templateList = await loadAllTemplates();
    const filtered = filterTemplatesByFolder(templateList, selectedFolderId);
    setTemplates(filtered);
  }, [selectedFolderId, loadAllTemplates, filterTemplatesByFolder]);

  return {
    templates,
    allTemplates,
    loading,
    error,
    refresh,
  };
};
