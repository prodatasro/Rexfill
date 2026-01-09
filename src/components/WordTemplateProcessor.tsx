import { Doc } from "@junobuild/core";
import { FC, useEffect, useState } from "react";
import { WordTemplateData } from "../types/word_template";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { readCustomProperties, writeCustomProperties, updateDocumentFields } from "../utils/customProperties";

interface WordTemplateProcessorProps {
  template?: Doc<WordTemplateData>;
  file?: File;
  onClose: () => void;
}

export const WordTemplateProcessor: FC<WordTemplateProcessorProps> = ({
  template,
  file,
  onClose,
}) => {
  const { t } = useTranslation();
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    extractPlaceholdersAndProperties();
  }, [template, file]);

  const extractPlaceholdersAndProperties = async () => {
    try {
      let arrayBuffer: ArrayBuffer;

      if (file) {
        // One-time processing - read file directly
        arrayBuffer = await file.arrayBuffer();
      } else if (template?.data.url) {
        // Saved template - fetch from URL
        const response = await fetch(template.data.url);
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error("No file or template provided");
      }
      const zip = new PizZip(arrayBuffer);

      // Read custom properties from the document
      const docCustomProperties = readCustomProperties(zip);
      setCustomProperties(docCustomProperties);

      // Extract the document.xml file directly to get all text content
      const documentXml = zip.file("word/document.xml");
      if (!documentXml) {
        throw new Error("Could not find document.xml in the Word file");
      }

      const xmlContent = documentXml.asText();

      // Parse XML to handle runs properly
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

      // Extract text from all text runs and concatenate to reconstruct original text
      const textRuns = xmlDoc.getElementsByTagName("w:t");
      let reconstructedText = "";

      for (let i = 0; i < textRuns.length; i++) {
        const textNode = textRuns[i];
        reconstructedText += textNode.textContent || "";
      }

      // Extract placeholders from reconstructed text
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = reconstructedText.match(placeholderRegex) || [];
      const uniquePlaceholders = [...new Set(matches.map(match => match.slice(2, -2).trim()))];

      setPlaceholders(uniquePlaceholders);

      // Initialize form data with both placeholders and custom properties
      const initialFormData: Record<string, string> = {};

      // Add placeholders
      uniquePlaceholders.forEach(placeholder => {
        initialFormData[placeholder] = '';
      });

      // Add custom properties
      Object.entries(docCustomProperties).forEach(([key, value]) => {
        initialFormData[key] = value;
      });

      setFormData(initialFormData);
    } catch (error) {
      console.error('Error extracting placeholders and properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (placeholder: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [placeholder]: value
    }));
  };

  const processDocument = async () => {
    setProcessing(true);
    try {
      let arrayBuffer: ArrayBuffer;

      if (file) {
        // One-time processing - read file directly
        arrayBuffer = await file.arrayBuffer();
      } else if (template?.data.url) {
        // Saved template - fetch from URL
        const response = await fetch(template.data.url);
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error("No file or template provided");
      }
      const zip = new PizZip(arrayBuffer);

      // Separate placeholders and custom properties
      const placeholderData: Record<string, string> = {};
      const customPropsData: Record<string, string> = {};

      // Determine which fields are custom properties vs placeholders
      Object.entries(formData).forEach(([key, value]) => {
        if (key in customProperties) {
          customPropsData[key] = value;
        } else {
          placeholderData[key] = value;
        }
      });

      // Write custom properties to the document
      if (Object.keys(customPropsData).length > 0) {
        writeCustomProperties(zip, customPropsData);
        updateDocumentFields(zip, customPropsData);
      }

      // Process placeholders with docxtemplater only if there are any
      if (placeholders.length > 0) {
        // Instead of trying to fix XML manually, let's use a different approach
        // We'll create a custom module to handle split placeholders
        const fixTextModule = {
          name: "FixTextModule",
          parse(placeHolderContent: any) {
            return placeHolderContent;
          },
          postparse(parsed: any) {
            // This runs after docxtemplater parses the document
            return parsed;
          },
          render(part: any) {
            return part;
          },
          postrender(parts: any) {
            return parts;
          },
          matchers() {
            return [];
          },
          set(options: any) {
            if (options.zip) {
              const documentXml = options.zip.file("word/document.xml");
              if (documentXml) {
                let xmlContent = documentXml.asText();

                // Simple approach: merge text nodes that contain placeholder parts
                // Look for patterns where braces are split across runs
                xmlContent = xmlContent.replace(
                  /(<w:t[^>]*>)([^<]*\{+[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*[}]+[^<]*?)(<\/w:t>)/g,
                  '$1$2$3$4'
                );

                // Handle cases where placeholders are split in the middle
                xmlContent = xmlContent.replace(
                  /(<w:t[^>]*>)([^<]*\{\{[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*\}\}[^<]*?)(<\/w:t>)/g,
                  '$1$2$3$4'
                );

                // More specific patterns for our placeholders
                placeholders.forEach(placeholder => {
                  const parts = placeholder.split('');
                  // Create regex that matches placeholder split at any position
                  for (let i = 1; i < parts.length; i++) {
                    const firstPart = '{{' + parts.slice(0, i).join('');
                    const secondPart = parts.slice(i).join('') + '}}';
                    const pattern = new RegExp(
                      `(<w:t[^>]*>)([^<]*${firstPart.replace(/[{}]/g, '\\$&')})<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*${secondPart.replace(/[{}]/g, '\\$&')}[^<]*?)(<\/w:t>)`,
                      'g'
                    );
                    xmlContent = xmlContent.replace(pattern, `$1$2$3$4`);
                  }
                });

                options.zip.file("word/document.xml", xmlContent);
              }
            }
          }
        };

        // Create Docxtemplater with the custom module
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => "",
          modules: [fixTextModule]
        });

        doc.setData(placeholderData);
        doc.render();
      }

      const output = zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const url = window.URL.createObjectURL(output);
      const a = document.createElement("a");
      a.href = url;
      const fileName = file ? file.name : template?.data.name || 'document.docx';
      a.download = `processed_${fileName}`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccessToast(t('templateProcessor.processSuccess'));
      onClose();
    } catch (error) {
      console.error('Error processing document:', error);
      // Try fallback approach without preprocessing
      try {
        let arrayBuffer: ArrayBuffer;

        if (file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (template?.data.url) {
          const response = await fetch(template.data.url);
          arrayBuffer = await response.arrayBuffer();
        } else {
          throw new Error("No file or template provided");
        }
        const zip = new PizZip(arrayBuffer);

        // Separate data again for fallback
        const placeholderData: Record<string, string> = {};
        const customPropsData: Record<string, string> = {};

        Object.entries(formData).forEach(([key, value]) => {
          if (key in customProperties) {
            customPropsData[key] = value;
          } else {
            placeholderData[key] = value;
          }
        });

        // Write custom properties
        if (Object.keys(customPropsData).length > 0) {
          writeCustomProperties(zip, customPropsData);
          updateDocumentFields(zip, customPropsData);
        }

        // Process placeholders if any
        if (placeholders.length > 0) {
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "",
            delimiters: {
              start: "{{",
              end: "}}"
            }
          });

          doc.setData(placeholderData);
          doc.render();
        }

        const output = zip.generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        const url = window.URL.createObjectURL(output);
        const a = document.createElement("a");
        a.href = url;
        const fileName = file ? file.name : template?.data.name || 'document.docx';
        a.download = `processed_${fileName}`;
        a.click();
        window.URL.revokeObjectURL(url);

        showSuccessToast(t('templateProcessor.processSuccess'));
        onClose();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        showErrorToast(t('templateProcessor.processError'));
      }
    } finally {
      setProcessing(false);
    }
  };

  // Form is valid if all required fields have values
  // For now, we consider all fields optional (can be empty)
  const isFormValid = true;

  // Get all field names (both placeholders and custom properties)
  const allFields = [...placeholders, ...Object.keys(customProperties)];

  return (
    <div className="min-h-screen">
      <div className="bg-linear-to-r from-blue-600 to-purple-600 p-4 sm:p-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div className="min-w-0 flex-1 pr-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                📄 {t('templateProcessor.title')}
              </h2>
              <p className="text-blue-100 text-xs sm:text-sm truncate">
                {file ? file.name : template?.data.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors p-2 rounded-full hover:bg-white/10 shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-4 sm:p-8 bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium">
                {t('templateProcessor.analyzing')}
              </p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {allFields.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="mb-4">
                    <span className="text-5xl sm:text-6xl">📋</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-lg sm:text-xl mb-2">
                    {t('templateProcessor.noPlaceholders')}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
                    {t('templateProcessor.noPlaceholdersDesc')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl sm:text-2xl">✨</span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                        {t('templateProcessor.customizationTitle')}
                      </h3>
                    </div>
                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: t('templateProcessor.customizationDesc', { count: allFields.length }) }}>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:gap-8">
                    {allFields.map((fieldName) => (
                      <div key={fieldName} className="space-y-2 sm:space-y-3">
                        <label className="block text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                          <span className="inline-flex items-center gap-2">
                            {fieldName in customProperties ? '📄' : '🏷️'} {fieldName}
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              value={formData[fieldName] || ''}
                              onChange={(e) => handleInputChange(fieldName, e.target.value)}
                              className="w-full px-4 py-4 sm:px-6 sm:py-5 pr-12 sm:pr-24 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 text-base sm:text-lg rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500"
                              placeholder={t('templateProcessor.enterValue', { placeholder: fieldName })}
                              autoComplete="off"
                            />
                            {formData[fieldName]?.trim() && (
                              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                <span className="text-green-500 text-lg sm:text-xl">✓</span>
                              </div>
                            )}
                            <div className="hidden sm:block absolute bottom-2 right-4 text-xs text-slate-400">
                              {formData[fieldName]?.length || 0} {t('templateProcessor.chars')}
                            </div>
                          </div>
                          <div className="sm:hidden text-xs text-slate-400 px-1">
                            {formData[fieldName]?.length || 0} {t('templateProcessor.chars')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <button
                        onClick={processDocument}
                        disabled={!isFormValid || processing}
                        className="flex-1 bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-3 sm:py-4 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2 sm:gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-2 border-white border-t-transparent"></div>
                            <span className="text-base sm:text-lg">{t('templateProcessor.processing')}</span>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2 sm:gap-3">
                            <span className="text-lg sm:text-xl">🚀</span>
                            <span className="text-base sm:text-lg">{t('templateProcessor.generateDocument')}</span>
                          </span>
                        )}
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 sm:flex-none sm:px-8 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold py-3 sm:py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
                      >
                        {t('templateProcessor.cancel')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
    </div>
  );
};
