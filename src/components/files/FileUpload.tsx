import { FC, useRef, useState } from 'react';
import { uploadFile } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import { showErrorToast, showWarningToast, showSuccessToast } from '../../utils/toast';
import { useTranslation } from 'react-i18next';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const FileUpload: FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const { t } = useTranslation();
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
      showWarningToast(t('fileUpload.invalidFileType'));
      return;
    }

    setUploading(true);
    try {
      // Check if file with same name already exists
      const fileExists = await checkFileExists(file.name);
      if (fileExists) {
        showWarningToast(t('fileUpload.fileExists', { filename: file.name }));
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

      showSuccessToast(t('fileUpload.uploadSuccess', { filename: file.name }));
      onUploadSuccess();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorToast(t('fileUpload.uploadFailed'));
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
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📤</div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            {t('fileUpload.title')}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            {t('fileUpload.description')}
          </p>
        </div>
        
        <button
          onClick={triggerFileSelect}
          disabled={uploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
              <span className="text-sm sm:text-base">{t('fileUpload.uploading')}</span>
            </span>
          ) : (
            `📁 ${t('fileUpload.chooseFile')}`
          )}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
