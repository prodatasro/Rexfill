import { createContext, useContext, FC, ReactNode, useState, useCallback } from 'react';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../types/word_template';
import type { FolderTreeNode } from '../types/folder';

interface SearchContextType {
  allTemplates: Doc<WordTemplateData>[];
  folderTree: FolderTreeNode[];
  setAllTemplates: (templates: Doc<WordTemplateData>[]) => void;
  setFolderTree: (tree: FolderTreeNode[]) => void;
  onSelectTemplate: ((template: Doc<WordTemplateData>) => void) | null;
  onSelectFolder: ((folderId: string | null) => void) | null;
  setOnSelectTemplate: (callback: ((template: Doc<WordTemplateData>) => void) | null) => void;
  setOnSelectFolder: (callback: ((folderId: string | null) => void) | null) => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export const SearchProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [allTemplates, setAllTemplatesState] = useState<Doc<WordTemplateData>[]>([]);
  const [folderTree, setFolderTreeState] = useState<FolderTreeNode[]>([]);
  const [onSelectTemplate, setOnSelectTemplateState] = useState<((template: Doc<WordTemplateData>) => void) | null>(null);
  const [onSelectFolder, setOnSelectFolderState] = useState<((folderId: string | null) => void) | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const setAllTemplates = useCallback((templates: Doc<WordTemplateData>[]) => {
    setAllTemplatesState(templates);
  }, []);

  const setFolderTree = useCallback((tree: FolderTreeNode[]) => {
    setFolderTreeState(tree);
  }, []);

  const setOnSelectTemplate = useCallback((callback: ((template: Doc<WordTemplateData>) => void) | null) => {
    setOnSelectTemplateState(() => callback);
  }, []);

  const setOnSelectFolder = useCallback((callback: ((folderId: string | null) => void) | null) => {
    setOnSelectFolderState(() => callback);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  return (
    <SearchContext.Provider
      value={{
        allTemplates,
        folderTree,
        setAllTemplates,
        setFolderTree,
        onSelectTemplate,
        onSelectFolder,
        setOnSelectTemplate,
        setOnSelectFolder,
        isSearchOpen,
        openSearch,
        closeSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
