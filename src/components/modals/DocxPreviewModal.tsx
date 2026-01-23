import { FC, useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { useTranslation } from 'react-i18next';

interface DocxPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileBlob: Blob | null;
}

const DocxPreviewModal: FC<DocxPreviewModalProps> = ({
  isOpen,
  onClose,
  fileName,
  fileBlob,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !fileBlob || !containerRef.current) return;

    setIsLoading(true);
    setError(null);

    const loadPreview = async () => {
      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          await renderAsync(fileBlob, containerRef.current);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error rendering DOCX preview:', err);
        setError(t('preview.errorLoading', { defaultValue: 'Failed to load preview' }));
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, fileBlob, t]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 truncate">
            {t('preview.title', { defaultValue: 'Preview' })}: {fileName}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-500 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="docx-page-container" style={{ display: isLoading ? 'none' : 'block' }}>
            <div
              ref={containerRef}
              className="docx-preview-wrapper"
            />
          </div>
        </div>
      </div>

      <style>{`
        .docx-page-container {
          max-width: 850px;
          margin: 0 auto;
        }
        .docx-preview-wrapper {
          background: white;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          min-height: 500px;
        }
      `}</style>
    </div>
  );
};

export default DocxPreviewModal;
