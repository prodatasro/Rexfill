import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SearchResult {
  fieldName: string;
  sectionId?: string; // For multi-file mode: fileId or 'shared'
  sectionName?: string; // For display: fileName or 'Shared Fields'
}

interface FieldSearchProps {
  fields: string[];
  // For multi-file mode
  sharedFields?: string[];
  fileFields?: Map<string, { fileName: string; fields: string[] }>;
  isMultiFileMode: boolean;
  onNavigateToField: (fieldName: string, sectionId?: string) => void;
}

export const FieldSearch: FC<FieldSearchProps> = ({
  fields,
  sharedFields,
  fileFields,
  isMultiFileMode,
  onNavigateToField,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Build search results based on mode
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    if (isMultiFileMode) {
      // Search in shared fields
      sharedFields?.forEach(fieldName => {
        if (fieldName.toLowerCase().includes(normalizedQuery)) {
          searchResults.push({
            fieldName,
            sectionId: 'shared',
            sectionName: t('templateProcessor.sharedFields'),
          });
        }
      });

      // Search in file-specific fields
      fileFields?.forEach((fileInfo, fileId) => {
        fileInfo.fields.forEach(fieldName => {
          if (fieldName.toLowerCase().includes(normalizedQuery)) {
            searchResults.push({
              fieldName,
              sectionId: fileId,
              sectionName: fileInfo.fileName,
            });
          }
        });
      });
    } else {
      // Single-file mode: search in all fields
      fields.forEach(fieldName => {
        if (fieldName.toLowerCase().includes(normalizedQuery)) {
          searchResults.push({ fieldName });
        }
      });
    }

    setResults(searchResults);
    setIsOpen(searchResults.length > 0);
    setSelectedIndex(0);
  }, [fields, sharedFields, fileFields, isMultiFileMode, t]);

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Navigate to selected field
  const handleSelectResult = (result: SearchResult) => {
    onNavigateToField(result.fieldName, result.sectionId);
    setIsOpen(false);
    // Don't clear query - user might want to navigate to another result
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          placeholder={t('templateProcessor.search.placeholder')}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"
        >
          {/* Result count */}
          <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span>{t('templateProcessor.search.results', { count: results.length })}</span>
            <span className="flex items-center gap-1 text-slate-400">
              <ChevronUp className="w-3 h-3" />
              <ChevronDown className="w-3 h-3" />
              {t('templateProcessor.search.navigateHint')}
            </span>
          </div>

          {/* Results list */}
          {results.map((result, index) => (
            <button
              key={`${result.sectionId || 'single'}-${result.fieldName}`}
              onClick={() => handleSelectResult(result)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-900 dark:text-slate-100'
              }`}
            >
              <span className="font-medium truncate">{result.fieldName}</span>
              {result.sectionName && (
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">
                  {result.sectionName}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg text-sm text-slate-500 dark:text-slate-400">
          {t('templateProcessor.search.noResults')}
        </div>
      )}
    </div>
  );
};
