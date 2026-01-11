import { createContext, useContext, useState, FC, ReactNode } from 'react';

interface FileProcessingContextType {
  oneTimeFile: File | null;
  setOneTimeFile: (file: File | null) => void;
}

const FileProcessingContext = createContext<FileProcessingContextType | undefined>(undefined);

export const FileProcessingProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [oneTimeFile, setOneTimeFile] = useState<File | null>(null);

  return (
    <FileProcessingContext.Provider value={{ oneTimeFile, setOneTimeFile }}>
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
