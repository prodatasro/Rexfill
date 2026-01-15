import { createContext, useContext, useState, FC, ReactNode } from 'react';

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

  const clearProcessingData = () => {
    setOneTimeFile(null);
    setMultiTemplateIds([]);
    setMultiFiles([]);
  };

  return (
    <FileProcessingContext.Provider value={{
      oneTimeFile,
      setOneTimeFile,
      multiTemplateIds,
      setMultiTemplateIds,
      multiFiles,
      setMultiFiles,
      clearProcessingData
    }}>
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
