import { FC, memo, useState, useEffect, useRef } from 'react';
import { FileText, Tag, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ColorVariant = 'green' | 'amber' | 'default';

interface FormFieldProps {
  fieldName: string;
  value: string;
  isCustomProperty: boolean;
  colorVariant: ColorVariant;
  onChange: (fieldName: string, value: string) => void;
}

const colorClasses: Record<ColorVariant, {
  icon: string;
  border: string;
  focus: string;
  hover: string;
}> = {
  green: {
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-300 dark:border-green-700/50',
    focus: 'focus:ring-green-500 focus:border-green-500',
    hover: 'hover:border-green-400 dark:hover:border-green-600',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700/50',
    focus: 'focus:ring-amber-500 focus:border-amber-500',
    hover: 'hover:border-amber-400 dark:hover:border-amber-600',
  },
  default: {
    icon: '',
    border: 'border-slate-300 dark:border-slate-600',
    focus: 'focus:ring-blue-500 focus:border-blue-500',
    hover: 'hover:border-slate-400 dark:hover:border-slate-500',
  },
};

const FormFieldComponent: FC<FormFieldProps> = ({
  fieldName,
  value,
  isCustomProperty,
  colorVariant,
  onChange,
}) => {
  const { t } = useTranslation();

  // Local state for immediate UI updates (prevents lag)
  const [localValue, setLocalValue] = useState(value);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync local state when parent value changes (e.g., form reset)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Debounce parent update (150ms balance between responsiveness and performance)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      onChange(fieldName, newValue);
    }, 150);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Flush pending changes on blur (ensures value is saved when user tabs away)
  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (localValue !== value) {
      onChange(fieldName, localValue);
    }
  };

  const colors = colorClasses[colorVariant];
  const IconComponent = isCustomProperty ? FileText : Tag;

  return (
    <div className="space-y-1">
      <label className="block text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
        <span className="inline-flex items-center gap-1.5">
          <IconComponent className={`w-3.5 h-3.5 ${colors.icon}`} />
          {fieldName}
        </span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 pr-10 bg-white dark:bg-slate-800 ${colors.border} text-slate-900 dark:text-slate-50 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 ${colors.focus} placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${colors.hover}`}
          placeholder={t('templateProcessor.enterValue', { placeholder: fieldName })}
          autoComplete="off"
        />
        {localValue?.trim() && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Check className="w-4 h-4 text-green-500" />
          </div>
        )}
      </div>
    </div>
  );
};

// Custom comparison - only re-render if these specific props change
// The onChange function is stable via useCallback in parent, so we exclude it from comparison
export const FormField = memo(FormFieldComponent, (prevProps, nextProps) => {
  return (
    prevProps.fieldName === nextProps.fieldName &&
    prevProps.value === nextProps.value &&
    prevProps.isCustomProperty === nextProps.isCustomProperty &&
    prevProps.colorVariant === nextProps.colorVariant
  );
});
