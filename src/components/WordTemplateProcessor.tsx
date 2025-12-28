import { Doc } from "@junobuild/core";
import { FC, useEffect, useState } from "react";
import { WordTemplateData } from "../types/word_template";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { showErrorToast, showSuccessToast } from "../utils/toast";

interface WordTemplateProcessorProps {
  template: Doc<WordTemplateData>;
  onClose: () => void;
}

export const WordTemplateProcessor: FC<WordTemplateProcessorProps> = ({
  template,
  onClose,
}) => {
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    extractPlaceholders();
  }, [template]);

  const extractPlaceholders = async () => {
    try {
      const response = await fetch(template.data.url!);
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
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
      
      console.log('Reconstructed text:', reconstructedText);
      
      // Extract placeholders from reconstructed text
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = reconstructedText.match(placeholderRegex) || [];
      const uniquePlaceholders = [...new Set(matches.map(match => match.slice(2, -2).trim()))];
      
      console.log('Found placeholders:', uniquePlaceholders);
      
      setPlaceholders(uniquePlaceholders);
      const initialFormData = uniquePlaceholders.reduce((acc, placeholder) => {
        acc[placeholder] = '';
        return acc;
      }, {} as Record<string, string>);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error extracting placeholders:', error);
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
      const response = await fetch(template.data.url!);
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      // Instead of trying to fix XML manually, let's use a different approach
      // We'll create a custom module to handle split placeholders
      const fixTextModule = {
        name: "FixTextModule",
        parse(placeHolderContent: any) {
          return placeHolderContent;
        },
        postparse(parsed: any, options: any) {
          // This runs after docxtemplater parses the document
          return parsed;
        },
        render(part: any, options: any) {
          return part;
        },
        postrender(parts: any, options: any) {
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
      
      doc.setData(formData);
      doc.render();

      const output = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const url = window.URL.createObjectURL(output);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processed_${template.data.name}`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccessToast('Document processed and downloaded successfully!');
      onClose();
    } catch (error) {
      console.error('Error processing document:', error);
      // Try fallback approach without preprocessing
      try {
        console.log('Trying fallback approach without XML preprocessing...');
        const response = await fetch(template.data.url!);
        const arrayBuffer = await response.arrayBuffer();
        const zip = new PizZip(arrayBuffer);
        
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => "",
          delimiters: {
            start: "{{",
            end: "}}"
          }
        });
        
        doc.setData(formData);
        doc.render();

        const output = doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        const url = window.URL.createObjectURL(output);
        const a = document.createElement("a");
        a.href = url;
        a.download = `processed_${template.data.name}`;
        a.click();
        window.URL.revokeObjectURL(url);

        showSuccessToast('Document processed and downloaded successfully!');
        onClose();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        showErrorToast('Error processing document. The Word file may have complex formatting that prevents placeholder replacement. Try recreating the document with simpler formatting.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const isFormValid = placeholders.every(placeholder => formData[placeholder]?.trim());

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                📄 Process Template
              </h2>
              <p className="text-blue-100 text-sm truncate max-w-2xl">
                {template.data.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-8">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">
                Analyzing template...
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {placeholders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mb-4">
                    <span className="text-6xl">📋</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-xl mb-2">
                    No placeholders found
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    This template doesn't contain any placeholders to fill.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">✨</span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        Template Customization
                      </h3>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      Found <strong>{placeholders.length}</strong> placeholder{placeholders.length !== 1 ? 's' : ''} in your template. 
                      Fill in the values below to personalize your document.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8">
                    {placeholders.map((placeholder) => (
                      <div key={placeholder} className="space-y-4">
                        <label className="block text-base font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                          <span className="inline-flex items-center gap-2">
                            🏷️ {placeholder}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData[placeholder] || ''}
                            onChange={(e) => handleInputChange(placeholder, e.target.value)}
                            className="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 text-lg rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500 font-mono"
                            placeholder={`Enter value for ${placeholder}... (50-60 characters recommended)`}
                            autoComplete="off"
                            style={{minWidth: '60ch'}}
                          />
                          {formData[placeholder]?.trim() && (
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                              <span className="text-green-500 text-xl">✓</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 right-4 text-xs text-slate-400">
                            {formData[placeholder]?.length || 0} chars
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={processDocument}
                        disabled={!isFormValid || processing}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none"
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                            <span className="text-lg">Processing...</span>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-3">
                            <span className="text-xl">🚀</span>
                            <span className="text-lg">Generate Document</span>
                          </span>
                        )}
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 sm:flex-none sm:px-8 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
