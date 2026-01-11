import { FC, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listDocs, Doc } from '@junobuild/core';
import { WordTemplateData } from '../types/word_template';
import { WordTemplateProcessor } from '../components/WordTemplateProcessor';
import { useFolders } from '../hooks/useFolders';
import { useTemplatesByFolder } from '../hooks/useTemplatesByFolder';
import { useFileProcessing } from '../contexts/FileProcessingContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const ProcessorPage: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [template, setTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const { oneTimeFile, setOneTimeFile } = useFileProcessing();

  // Load all templates to build folder tree
  const { allTemplates } = useTemplatesByFolder(null);
  const { folderTree } = useFolders(allTemplates);

  useEffect(() => {
    const loadData = async () => {
      const templateId = searchParams.get('id');

      // Check if we have a one-time file in context
      if (oneTimeFile) {
        setFile(oneTimeFile);
        setLoading(false);
        return;
      }

      if (!templateId) {
        // No template ID and no file, redirect to dashboard
        navigate('/');
        return;
      }

      try {
        // Fetch the template by ID
        const docs = await listDocs<WordTemplateData>({
          collection: 'templates_meta',
          filter: {}
        });

        const foundTemplate = docs.items.find(doc => doc.key === templateId);

        if (foundTemplate) {
          setTemplate(foundTemplate);
        } else {
          // Template not found, redirect to dashboard
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [searchParams, navigate, oneTimeFile]);

  const handleClose = () => {
    // Clear one-time file from context
    if (oneTimeFile) {
      setOneTimeFile(null);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!template && !file) {
    return null;
  }

  return (
    <WordTemplateProcessor
      template={template || undefined}
      file={file || undefined}
      onClose={handleClose}
      folderTree={folderTree}
    />
  );
};

export default ProcessorPage;
