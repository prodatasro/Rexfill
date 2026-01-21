import { FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, FileText, Folder, Command, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Doc } from '@junobuild/core';
import type { WordTemplateData } from '../../types/word-template';
import type { FolderTreeNode } from '../../types/folder';
import { useSearch } from '../../contexts/SearchContext';

interface GlobalSearchProps {
  allTemplates: Doc<WordTemplateData>[];
  folderTree: FolderTreeNode[];
  onSelectTemplate: (template: Doc<WordTemplateData>) => void;
  onSelectFolder: (folderId: string | null) => void;
}

interface SearchResult {
  type: 'template' | 'folder';
  id: string;
  name: string;
  path?: string;
  template?: Doc<WordTemplateData>;
  folderId?: string | null;
}

export const GlobalSearch: FC<GlobalSearchProps> = ({
  allTemplates,
  folderTree,
  onSelectTemplate,
  onSelectFolder,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isSearchOpen, openSearch, closeSearch } = useSearch();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Flatten folder tree for searching
  const flattenFolders = useCallback((nodes: FolderTreeNode[]): SearchResult[] => {
    const results: SearchResult[] = [];
    const traverse = (nodeList: FolderTreeNode[]) => {
      for (const node of nodeList) {
        results.push({
          type: 'folder',
          id: node.folder.key,
          name: node.folder.data.name,
          path: node.folder.data.path,
          folderId: node.folder.key,
        });
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return results;
  }, []);

  // Search results (all matching results, sorted)
  const allResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search templates
    allTemplates.forEach((template) => {
      const nameMatch = template.data.name.toLowerCase().includes(lowerQuery);
      const pathMatch = template.data.folderPath?.toLowerCase().includes(lowerQuery);
      const fullPathMatch = template.data.fullPath?.toLowerCase().includes(lowerQuery);

      if (nameMatch || pathMatch || fullPathMatch) {
        searchResults.push({
          type: 'template',
          id: template.key,
          name: template.data.name,
          path: template.data.folderPath || '/',
          template,
        });
      }
    });

    // Search folders
    const folders = flattenFolders(folderTree);
    folders.forEach((folder) => {
      const nameMatch = folder.name.toLowerCase().includes(lowerQuery);
      const pathMatch = folder.path?.toLowerCase().includes(lowerQuery);

      if (nameMatch || pathMatch) {
        searchResults.push(folder);
      }
    });

    // Sort: templates first, then folders, alphabetically within each group
    return searchResults.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'template' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [query, allTemplates, folderTree, flattenFolders]);

  // Displayed results (limited by visibleCount)
  const results = useMemo(() => {
    return allResults.slice(0, visibleCount);
  }, [allResults, visibleCount]);

  // Reset visibleCount when query changes
  useEffect(() => {
    setVisibleCount(10);
  }, [query]);

  // Handle keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, openSearch, closeSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isSearchOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  // Handle keyboard navigation in results
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle selection
  const handleSelect = useCallback((result: SearchResult) => {
    closeSearch();
    if (result.type === 'template' && result.template) {
      onSelectTemplate(result.template);
    } else if (result.type === 'folder') {
      onSelectFolder(result.folderId ?? null);
      navigate('/app');
    }
  }, [onSelectTemplate, onSelectFolder, navigate, closeSearch]);

  // Handle go to folder (for templates)
  const handleGoToFolder = useCallback((e: React.MouseEvent, result: SearchResult) => {
    e.stopPropagation();
    closeSearch();
    if (result.type === 'template' && result.template) {
      onSelectFolder(result.template.data.folderId ?? null);
      navigate('/app');
    }
  }, [onSelectFolder, navigate, closeSearch]);

  // Handle "Show more" click
  const handleShowMore = useCallback(() => {
    setVisibleCount(prev => prev + 10);
  }, []);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isSearchOpen) {
    return (
      <button
        onClick={openSearch}
        className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-500 dark:text-slate-400 text-sm"
        aria-label={t('globalSearch.placeholder')}
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">{t('globalSearch.placeholder')}</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-xs font-mono">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={closeSearch}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('globalSearch.title')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('globalSearch.inputPlaceholder')}
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-base"
          />
          <button
            onClick={closeSearch}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label={t('globalSearch.close')}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
              {t('globalSearch.noResults')}
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <button
                onClick={() => handleSelect(result)}
                className="flex-1 flex items-center gap-3 text-left min-w-0"
              >
                {result.type === 'template' ? (
                  <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                ) : (
                  <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {result.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {result.path || '/'}
                    {result.type === 'template' && result.template && (
                      <span className="ml-2">• {formatSize(result.template.data.size)}</span>
                    )}
                  </div>
                </div>
              </button>
              {result.type === 'template' && (
                <button
                  onClick={(e) => handleGoToFolder(e, result)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors shrink-0"
                  title={t('globalSearch.goToFolder')}
                  aria-label={t('globalSearch.goToFolder')}
                >
                  <FolderOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
              )}
              {index === selectedIndex && (
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  ↵
                </kbd>
              )}
            </div>
          ))}

          {/* Show more button */}
          {allResults.length > visibleCount && (
            <button
              onClick={handleShowMore}
              className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 transition-colors"
            >
              {t('globalSearch.showMore', { remaining: allResults.length - visibleCount })}
            </button>
          )}
        </div>

        {/* Footer hints */}
        {query.trim() && results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↑</kbd>
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↓</kbd>
              {t('globalSearch.navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↵</kbd>
              {t('globalSearch.select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">esc</kbd>
              {t('globalSearch.close')}
            </span>
          </div>
        )}

        {/* Empty state hint */}
        {!query.trim() && (
          <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
            <p>{t('globalSearch.hint')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
