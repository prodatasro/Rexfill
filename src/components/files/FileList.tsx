import { FC, useEffect, useState } from 'react';
import { listDocs, deleteDoc, deleteAsset, Doc } from '@junobuild/core';
import { WordTemplateData } from '../../types/word_template';
import LoadingSpinner from '../ui/LoadingSpinner';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { useConfirm } from '../../contexts/ConfirmContext';

interface FileListProps {
  onTemplateSelect: (template: Doc<WordTemplateData>) => void;
  onFileDeleted: () => void;
  refreshTrigger: number;
}

const FileList: FC<FileListProps> = ({ onTemplateSelect, onFileDeleted, refreshTrigger }) => {
  const [templates, setTemplates] = useState<Doc<WordTemplateData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { confirm } = useConfirm();

  useEffect(() => {
    loadTemplates();
  }, [refreshTrigger]);

  const loadTemplates = async () => {
    try {
      const result = await listDocs({
        collection: 'templates_meta'
      });
      setTemplates(result.items as Doc<WordTemplateData>[]);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: Doc<WordTemplateData>) => {
    const confirmed = await confirm({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.data.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeletingIds(prev => new Set([...prev, template.key]));
    try {
      // Delete from storage
      await deleteAsset({
        collection: 'templates',
        fullPath: `/templates/${template.data.name}`
      });

      // Delete metadata from datastore
      await deleteDoc({
        collection: 'templates_meta',
        doc: template
      });

      showSuccessToast(`Template "${template.data.name}" deleted successfully`);
      onFileDeleted();
    } catch (error) {
      console.error('Delete failed:', error);
      showErrorToast('Failed to delete file. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.key);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          No templates yet
        </h3>
        <p className="text-slate-600 dark:text-slate-300">
          Upload your first Word template to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => {
        const isDeleting = deletingIds.has(template.key);
        
        return (
          <div
            key={template.key}
            className="card p-6 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">📄</div>
              <button
                onClick={() => handleDelete(template)}
                disabled={isDeleting}
                className="text-red-500 hover:text-red-700 disabled:text-slate-400 transition-colors p-1"
                title="Delete template"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
            
            <h3 className="font-bold text-slate-900 dark:text-slate-50 mb-2 truncate" title={template.data.name}>
              {template.data.name}
            </h3>
            
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-4">
              <p>Size: {formatFileSize(template.data.size)}</p>
              <p>Uploaded: {formatDate(template.data.uploadedAt)}</p>
            </div>
            
            <button
              onClick={() => onTemplateSelect(template)}
              disabled={isDeleting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              ✨ Process Template
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default FileList;
