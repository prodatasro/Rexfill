import { createContext, useContext, useState, useMemo, useCallback, FC, ReactNode } from 'react';

interface FileProcessingContextType {
  // Single file processing (legacy)
  oneTimeFile: File | null;
  setOneTimeFile: (file: File | null) => void;

  // Multi-file processing
  multiTemplateIds: string[];
  setMultiTemplateIds: (ids: string[]) => void;
  multiFiles: File[];
  setMultiFiles: (files: File[]) => void;

  // Clear all processing data
  clearProcessingData: () => void;
}

const FileProcessingContext = createContext<FileProcessingContextType | undefined>(undefined);

export const FileProcessingProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [oneTimeFile, setOneTimeFile] = useState<File | null>(null);
  const [multiTemplateIds, setMultiTemplateIds] = useState<string[]>([]);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);

  const clearProcessingData = useCallback(() => {
    setOneTimeFile(null);
    setMultiTemplateIds([]);
    setMultiFiles([]);
  }, []);

  const value = useMemo(() => ({
    oneTimeFile,
    setOneTimeFile,
    multiTemplateIds,
    setMultiTemplateIds,
    multiFiles,
    setMultiFiles,
    clearProcessingData
  }), [oneTimeFile, multiTemplateIds, multiFiles, clearProcessingData]);

  return (
    <FileProcessingContext.Provider value={value}>
      {children}
    </FileProcessingContext.Provider>
  );
};

export const useFileProcessing = () => {
  const context = useContext(FileProcessingContext);
  if (!context) {
    throw new Error('useFileProcessing must be used within FileProcessingProvider');
  }
  return context;
};
