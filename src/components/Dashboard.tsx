import { FC, useState } from 'react';
import { Doc } from '@junobuild/core';
import { WordTemplateData } from '../types/word_template';
import FileUpload from './files/FileUpload';
import FileList from './files/FileList.tsx';
import { WordTemplateProcessor } from './WordTemplateProcessor';

const Dashboard: FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<Doc<WordTemplateData> | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTemplateSelect = (template: Doc<WordTemplateData>) => {
    setSelectedTemplate(template);
  };

  const handleCloseProcessor = () => {
    setSelectedTemplate(null);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4 uppercase tracking-wide">
          📁 Your Word Templates
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-lg">
          Upload DOCX files with placeholders like {'{{'}name{'}}'}  and fill them dynamically
        </p>
      </div>

      <FileUpload onUploadSuccess={triggerRefresh} />
      
      <FileList 
        onTemplateSelect={handleTemplateSelect}
        onFileDeleted={triggerRefresh}
        refreshTrigger={refreshTrigger}
      />

      {selectedTemplate && (
        <WordTemplateProcessor
          template={selectedTemplate}
          onClose={handleCloseProcessor}
        />
      )}
    </div>
  );
};

export default Dashboard;
