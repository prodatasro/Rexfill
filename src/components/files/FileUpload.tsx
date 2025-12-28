import { FC, useRef, useState } from 'react';
import { uploadFile } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import { showErrorToast, showWarningToast, showSuccessToast } from '../../utils/toast';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const FileUpload: FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkFileExists = async (filename: string): Promise<boolean> => {
    try {
      const { listDocs } = await import('@junobuild/core');
      const docs = await listDocs({
        collection: 'templates_meta'
      });
      
      return docs.items.some(doc => (doc.data as any)?.name === filename);
    } catch (error) {
      console.error('Error checking existing files:', error);
      return false;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      showWarningToast('Please select a .docx file');
      return;
    }

    setUploading(true);
    try {
      // Check if file with same name already exists
      const fileExists = await checkFileExists(file.name);
      if (fileExists) {
        showWarningToast(`A file with the name "${file.name}" already exists. Please rename your file or choose a different one.`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      const templateData: WordTemplateData = {
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

      const result = await uploadFile({
        data: file,
        collection: 'templates',
        filename: file.name
      });

      // Store template metadata in datastore
      const { setDoc } = await import('@junobuild/core');
      await setDoc({
        collection: 'templates_meta',
        doc: {
          key: result.name, // Use the uploaded file name as key
          data: {
            ...templateData,
            url: result.downloadUrl
          }
        }
      });

      showSuccessToast(`Template "${file.name}" uploaded successfully!`);
      onUploadSuccess();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="card p-6">
      <div className="text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="mb-4">
          <div className="text-6xl mb-4">📤</div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Upload Word Template
          </h3>
          <p className="text-slate-600 dark:text-slate-300">
            Select a .docx file with placeholders to upload
          </p>
        </div>
        
        <button
          onClick={triggerFileSelect}
          disabled={uploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Uploading...
            </span>
          ) : (
            '📁 Choose File'
          )}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
