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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Process Template: {template.data.name}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {placeholders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-300 text-lg">
                  No placeholders found in this template.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    📝 Fill in the values for the placeholders found in the template:
                  </p>
                </div>
                
                <div className="space-y-4">
                  {placeholders.map((placeholder) => (
                    <div key={placeholder} className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
                        {placeholder}
                      </label>
                      <input
                        type="text"
                        value={formData[placeholder] || ''}
                        onChange={(e) => handleInputChange(placeholder, e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-200"
                        placeholder={`Enter value for ${placeholder}...`}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={processDocument}
                    disabled={!isFormValid || processing}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </span>
                    ) : (
                      '✨ Generate Document'
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
