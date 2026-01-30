import { FC, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Doc } from '@junobuild/core';
import { WordTemplateData } from '../../types/word-template';
import { WordTemplateProcessor } from '../../components/processor/WordTemplateProcessor';
import { useFolders } from '../../hooks/useFolders';
import { useTemplatesQuery } from '../../hooks/useTemplatesQuery';
import { useFileProcessing } from '../../contexts/FileProcessingContext';
import { useProcessor } from '../../contexts/ProcessorContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

const ProcessorPage: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Single template mode (backward compatible)
  const [template, setTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // Multi-template mode
  const [templates, setTemplates] = useState<Doc<WordTemplateData>[]>([]);
  const [loading, setLoading] = useState(true);
  const { oneTimeFile, clearProcessingData } = useFileProcessing();
  const { setCurrentFolderId } = useProcessor();

  // Load all templates to build folder tree using TanStack Query
  const { data: allTemplates = [], isLoading: templatesLoading } = useTemplatesQuery();
  const { folderTree } = useFolders(allTemplates);

  // Determine if we're in multi-file mode
  const isMultiFileMode = templates.length > 1;

  useEffect(() => {
    const loadData = async () => {
      const templateId = searchParams.get('id');
      const templateIds = searchParams.get('ids');

      // Check if we have a one-time file in context
      if (oneTimeFile) {
        setFile(oneTimeFile);
        setLoading(false);
        return;
      }

      // Multi-template mode: ids param contains comma-separated template keys
      if (templateIds) {
        try {
          const ids = templateIds.split(',').filter(id => id.trim());
          if (ids.length === 0) {
            navigate('/app');
            return;
          }

          // Wait for templates to load from cache
          if (templatesLoading) {
            return; // Keep loading state
          }

          // Use cached templates
          const foundTemplates = ids
            .map(id => allTemplates.find(doc => doc.key === id))
            .filter((t): t is Doc<WordTemplateData> => t !== undefined);

          if (foundTemplates.length === 0) {
            navigate('/app');
            return;
          }

          if (foundTemplates.length === 1) {
            // Single template found, use single mode
            setTemplate(foundTemplates[0]);
            setCurrentFolderId(foundTemplates[0].data.folderId || null);
          } else {
            // Multiple templates found
            setTemplates(foundTemplates);
            // Use the folder of the first template for navigation
            setCurrentFolderId(foundTemplates[0].data.folderId || null);
          }
        } catch (error) {
          console.error('Failed to load templates:', error);
          navigate('/app');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Single template mode (backward compatible)
      if (!templateId) {
        navigate('/app');
        return;
      }

      try {
        // Wait for templates to load from cache
        if (templatesLoading) {
          return; // Keep loading state
        }

        // Use cached templates
        const foundTemplate = allTemplates.find(doc => doc.key === templateId);

        if (foundTemplate) {
          setTemplate(foundTemplate);
          setCurrentFolderId(foundTemplate.data.folderId || null);
        } else {
          navigate('/app');
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        navigate('/app');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [searchParams, navigate, oneTimeFile, setCurrentFolderId, allTemplates, templatesLoading]);

  const handleClose = () => {
    // Clear all processing data from context
    clearProcessingData();

    // Navigate back to dashboard
    // Note: Don't clear currentFolderId here - it may have been updated by Save As
    // The dashboard will use the current folder context
    navigate('/app');
  };

  const handleTemplateChange = (newTemplate: Doc<WordTemplateData>) => {
    // Switch to the new template (only for single template mode)
    setTemplate(newTemplate);
    setTemplates([]); // Clear multi-template mode
    setFile(null); // Clear file if it was a one-time file
    // Update the URL to reflect the new template
    navigate(`/app/process?id=${newTemplate.key}`, { replace: true });
    // Update context with new folder
    setCurrentFolderId(newTemplate.data.folderId || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Multi-file mode
  if (isMultiFileMode) {
    return (
      <ErrorBoundary>
        <WordTemplateProcessor
          templates={templates}
          onClose={handleClose}
          folderTree={folderTree}
          onFolderSelect={setCurrentFolderId}
        />
      </ErrorBoundary>
    );
  }

  // Single file mode
  if (!template && !file) {
    return null;
  }

  return (
    <ErrorBoundary>
      <WordTemplateProcessor
        template={template || undefined}
        file={file || undefined}
        onClose={handleClose}
        folderTree={folderTree}
        onTemplateChange={handleTemplateChange}
        onFolderSelect={setCurrentFolderId}
      />
    </ErrorBoundary>
  );
};

export default ProcessorPage;
