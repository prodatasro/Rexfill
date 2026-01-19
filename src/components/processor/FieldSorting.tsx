import { FC } from 'react';
import { ArrowUpDown, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type SortOption = 'default' | 'asc' | 'desc';

interface FieldSortingProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export const FieldSorting: FC<FieldSortingProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  const options: { value: SortOption; label: string; icon: typeof ArrowUpDown }[] = [
    { value: 'default', label: t('templateProcessor.sort.default'), icon: ArrowUpDown },
    { value: 'asc', label: t('templateProcessor.sort.asc'), icon: ArrowUpAZ },
    { value: 'desc', label: t('templateProcessor.sort.desc'), icon: ArrowDownAZ },
  ];

  return (
    <div className="flex items-center gap-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};

// Utility function to sort fields based on sort option
export const sortFields = (fields: string[], sortOption: SortOption): string[] => {
  if (sortOption === 'default') {
    return fields; // Keep original order
  }

  const sorted = [...fields].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  return sortOption === 'desc' ? sorted.reverse() : sorted;
};
