import { FC, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, ChevronDown, ChevronRight, Files, Tag, Check } from 'lucide-react';
import { FormField, ColorVariant } from './FormField';

interface VirtualizedFieldListProps {
  // Single-file mode - customPropertiesRecord maps fieldName to value (presence = is custom property)
  fields?: string[];
  customPropertiesRecord?: Record<string, string>;
  // Multi-file mode
  sharedFields?: string[];
  fileFields?: Map<string, { fileName: string; fields: string[] }>;
  expandedFiles?: Set<string>;
  sharedFieldsExpanded?: boolean;
  isCustomProperty?: Record<string, boolean>;
  // Common
  formData: Record<string, string>;
  onInputChange: (fieldName: string, value: string) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleSharedFields?: () => void;
  // Mode indicator
  isMultiFileMode: boolean;
  fileCount?: number;
}

// Reusable field input component for non-virtualized rendering
const FieldInput: FC<{
  fieldName: string;
  value: string;
  isCustomProperty: boolean;
  colorVariant: ColorVariant;
  onChange: (fieldName: string, value: string) => void;
}> = ({ fieldName, value, isCustomProperty, colorVariant, onChange }) => {
  const { t } = useTranslation();

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
          value={value}
          onChange={(e) => onChange(fieldName, e.target.value)}
          className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 pr-10 bg-white dark:bg-slate-800 ${colors.border} text-slate-900 dark:text-slate-50 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 ${colors.focus} placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${colors.hover}`}
          placeholder={t('templateProcessor.enterValue', { placeholder: fieldName })}
          autoComplete="off"
        />
        {value?.trim() && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Check className="w-4 h-4 text-green-500" />
          </div>
        )}
      </div>
    </div>
  );
};

export const VirtualizedFieldList: FC<VirtualizedFieldListProps> = ({
  fields,
  customPropertiesRecord,
  sharedFields,
  fileFields,
  expandedFiles,
  sharedFieldsExpanded,
  isCustomProperty,
  formData,
  onInputChange,
  onToggleSection,
  onToggleSharedFields,
  isMultiFileMode,
  fileCount = 0,
}) => {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  // Stable onChange callback for memoized FormField
  const handleInputChange = useCallback(
    (fieldName: string, value: string) => {
      onInputChange(fieldName, value);
    },
    [onInputChange]
  );

  // Determine if a field is a custom property
  const getIsCustomProperty = useCallback(
    (fieldName: string): boolean => {
      if (isMultiFileMode) {
        return isCustomProperty?.[fieldName] ?? false;
      }
      return customPropertiesRecord ? fieldName in customPropertiesRecord : false;
    },
    [isMultiFileMode, isCustomProperty, customPropertiesRecord]
  );

  // Calculate total field count for single-file mode virtualization
  const totalFields = fields?.length || 0;

  // Single-file mode with virtualization for many fields
  const rowVirtualizer = useVirtualizer({
    count: totalFields,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Field height estimate
    overscan: 5,
    enabled: !isMultiFileMode && totalFields > 20,
  });

  // Multi-file mode: render original layout (no virtualization for sections)
  if (isMultiFileMode) {
    const allFieldCount = (sharedFields?.length || 0) +
      Array.from(fileFields?.values() || []).reduce((sum, f) => sum + f.fields.length, 0);

    return (
      <div className="space-y-4">
        {/* Info banner */}
        <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Files className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
              {t('templateProcessor.multiFileDesc', { fileCount, fieldCount: allFieldCount })}
            </h3>
          </div>
        </div>

        {/* Shared Fields Section */}
        {sharedFields && sharedFields.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden border-l-4 border-l-green-500 dark:border-l-green-600">
            <button
              onClick={onToggleSharedFields}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100/50 dark:hover:bg-green-900/30 transition-colors"
            >
              <span className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('templateProcessor.sharedFields')}
                <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                  {sharedFields.length}
                </span>
              </span>
              {sharedFieldsExpanded ? (
                <ChevronDown className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
            </button>

            {sharedFieldsExpanded && (
              <div className="px-4 pb-4 border-t border-green-200 dark:border-green-800 bg-white/50 dark:bg-slate-800/30">
                <div className="grid grid-cols-1 gap-3 pt-3">
                  {sharedFields.map((fieldName) => (
                    <FieldInput
                      key={fieldName}
                      fieldName={fieldName}
                      value={formData[fieldName] || ''}
                      isCustomProperty={getIsCustomProperty(fieldName)}
                      colorVariant="green"
                      onChange={handleInputChange}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Per-file Unique Fields Sections */}
        {fileFields && Array.from(fileFields.entries()).map(([fileId, fileInfo]) => {
          if (fileInfo.fields.length === 0) return null;
          const isExpanded = expandedFiles?.has(fileId) ?? true;

          return (
            <div key={fileId} className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg overflow-hidden border-l-4 border-l-amber-400 dark:border-l-amber-600">
              <button
                onClick={() => onToggleSection?.(fileId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {fileInfo.fileName}
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    {fileInfo.fields.length} {t('templateProcessor.uniqueFields')}
                  </span>
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-800/50 bg-white/50 dark:bg-slate-800/30">
                  <div className="grid grid-cols-1 gap-3 pt-3">
                    {fileInfo.fields.map((fieldName) => (
                      <FieldInput
                        key={fieldName}
                        fieldName={fieldName}
                        value={formData[fieldName] || ''}
                        isCustomProperty={getIsCustomProperty(fieldName)}
                        colorVariant="amber"
                        onChange={handleInputChange}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Single-file mode: flat list of all fields
  // Use virtualization only for many fields (> 20)
  if (fields && totalFields > 20) {
    return (
      <div
        ref={parentRef}
        className="h-[60vh] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const fieldName = fields[virtualItem.index];
            return (
              <div
                key={fieldName}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: '12px',
                }}
              >
                <FormField
                  fieldName={fieldName}
                  value={formData[fieldName] || ''}
                  isCustomProperty={getIsCustomProperty(fieldName)}
                  colorVariant="default"
                  onChange={handleInputChange}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Single-file mode with few fields: no virtualization
  return (
    <div className="grid grid-cols-1 gap-3">
      {fields?.map((fieldName) => (
        <FormField
          key={fieldName}
          fieldName={fieldName}
          value={formData[fieldName] || ''}
          isCustomProperty={getIsCustomProperty(fieldName)}
          colorVariant="default"
          onChange={handleInputChange}
        />
      ))}
    </div>
  );
};
