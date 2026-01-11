import { createContext, useContext, useState, FC, ReactNode, useCallback, useMemo, useRef } from 'react';

interface ProcessorContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  requestNavigation: () => void;
  setRequestNavigation: (callback: (() => void) | null) => void;
  currentFolderId: string | null;
  setCurrentFolderId: (folderId: string | null) => void;
}

const ProcessorContext = createContext<ProcessorContextType | undefined>(undefined);

export const ProcessorProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  // Use a ref to store the callback to avoid infinite loops
  const requestNavigationRef = useRef<(() => void) | null>(null);

  // Wrapper to log when unsaved changes are set
  const setHasUnsavedChanges = useCallback((value: boolean) => {
    console.log('ProcessorContext: setHasUnsavedChanges called with:', value);
    setHasUnsavedChangesState(value);
  }, []);

  // Wrapper to set the navigation callback
  const setRequestNavigation = useCallback((callback: (() => void) | null) => {
    requestNavigationRef.current = callback;
  }, []);

  // Wrapper to call the navigation callback from the ref
  const requestNavigation = useCallback(() => {
    if (requestNavigationRef.current) {
      requestNavigationRef.current();
    }
  }, []);

  // Memoize the context value - only re-create when dependencies change
  const contextValue = useMemo(() => ({
    hasUnsavedChanges,
    setHasUnsavedChanges,
    requestNavigation,
    setRequestNavigation,
    currentFolderId,
    setCurrentFolderId
  }), [hasUnsavedChanges, requestNavigation, setRequestNavigation, currentFolderId]);

  return (
    <ProcessorContext.Provider value={contextValue}>
      {children}
    </ProcessorContext.Provider>
  );
};

export const useProcessor = () => {
  const context = useContext(ProcessorContext);
  if (!context) {
    throw new Error('useProcessor must be used within ProcessorProvider');
  }
  return context;
};
