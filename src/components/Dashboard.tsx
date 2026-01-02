import { FC, useState } from 'react';
import { Doc } from '@junobuild/core';
import { WordTemplateData } from '../types/word_template';
import FileUpload from './files/FileUpload';
import FileList from './files/FileList.tsx';
import { WordTemplateProcessor } from './WordTemplateProcessor';
import { useTranslation } from 'react-i18next';

const Dashboard: FC = () => {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTemplateSelect = (template: Doc<WordTemplateData>) => {
    setSelectedTemplate(template);
    setSelectedFile(null);
  };

  const handleOneTimeProcess = (file: File) => {
    setSelectedFile(file);
    setSelectedTemplate(null);
  };

  const handleCloseProcessor = () => {
    setSelectedTemplate(null);
    setSelectedFile(null);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (selectedTemplate || selectedFile) {
    return (
      <WordTemplateProcessor
        template={selectedTemplate || undefined}
        file={selectedFile || undefined}
        onClose={handleCloseProcessor}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="text-center px-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-3 sm:mb-4 uppercase tracking-wide">
          📁 {t('dashboard.title')}
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <FileUpload
        onUploadSuccess={triggerRefresh}
        onOneTimeProcess={handleOneTimeProcess}
      />
      
      <FileList 
        onTemplateSelect={handleTemplateSelect}
        onFileDeleted={triggerRefresh}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default Dashboard;
