/**
 * Optimized document processing functions for Web Worker
 * These are pure functions that can run in a worker context
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Escape special XML characters
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escape special characters for use in regular expressions
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all document file paths that might contain fields
 */
function getDocumentFilePaths(zip: PizZip): string[] {
  const filePaths: string[] = [];

  if (zip.file("word/document.xml")) {
    filePaths.push("word/document.xml");
  }

  Object.keys(zip.files).forEach(name => {
    if (name.match(/word\/header\d*\.xml/) || name.match(/word\/footer\d*\.xml/)) {
      filePaths.push(name);
    }
  });

  return filePaths;
}

/**
 * OPTIMIZED: Update document fields with a single-pass approach
 * Instead of iterating through each property (O(n)), we build a combined regex
 * that matches all property names at once (O(1))
 */
export function updateDocumentFieldsOptimized(
  zip: PizZip,
  properties: Record<string, string>,
  onProgress?: (percent: number) => void
): void {
  const propEntries = Object.entries(properties);
  if (propEntries.length === 0) return;

  const propMap = new Map(propEntries);
  const propNames = [...propMap.keys()];

  // Build alternation pattern for all property names
  const escapedNames = propNames.map(n => escapeRegex(n)).join('|');

  // Combined simple field pattern that captures property name
  const simpleFieldPattern = new RegExp(
    `(<w:fldSimple[^>]*w:instr="[^"]*DOCPROPERTY\\s+(?:&quot;)?\\s*)(${escapedNames})(\\s*(?:&quot;)?\\s*[^"]*"[^>]*>` +
    `<w:r[^>]*>(?:<w:rPr[^>]*>.*?</w:rPr>)?<w:t[^>]*>)[^<]*(</w:t></w:r></w:fldSimple>)`,
    'gi'
  );

  // Combined complex field pattern that captures property name
  const complexFieldPattern = new RegExp(
    `(<w:fldChar w:fldCharType="begin"[^>]*/>` +
    `[\\s\\S]*?<w:instrText[^>]*>\\s*DOCPROPERTY\\s+(?:&quot;)?\\s*)(${escapedNames})(\\s*(?:&quot;)?\\s*[^<]*</w:instrText>` +
    `[\\s\\S]*?<w:fldChar w:fldCharType="separate"[^>]*/>)` +
    `([\\s\\S]*?)` +
    `(<w:fldChar w:fldCharType="end"[^>]*/>)`,
    'gi'
  );

  const filePaths = getDocumentFilePaths(zip);
  const totalFiles = filePaths.length;

  filePaths.forEach((fileName, index) => {
    const file = zip.file(fileName);
    if (!file) return;

    let xmlContent = file.asText();

    // Single pass for simple fields
    xmlContent = xmlContent.replace(
      simpleFieldPattern,
      (_match, before, propName, middle, after) => {
        const value = propMap.get(propName);
        if (value === undefined) return _match;
        return `${before}${propName}${middle}${escapeXml(value)}${after}`;
      }
    );

    // Single pass for complex fields
    xmlContent = xmlContent.replace(
      complexFieldPattern,
      (_fullMatch, before, propName, middle, content, after) => {
        const value = propMap.get(propName);
        if (value === undefined) return _fullMatch;

        // Replace all text content between separate and end with new value
        const newContent = content.replace(
          /(<w:t[^>]*>)[^<]*(<\/w:t>)/g,
          `$1${escapeXml(value)}$2`
        );
        return before + propName + middle + newContent + after;
      }
    );

    zip.file(fileName, xmlContent);

    if (onProgress) {
      onProgress(((index + 1) / totalFiles) * 100);
    }
  });
}

/**
 * Fix split placeholders in the document XML
 * Runs a two-pass approach: generic patterns first, then specific placeholders
 */
export function fixSplitPlaceholders(xmlContent: string, placeholders: string[]): string {
  // Generic pattern to fix common split cases
  let result = xmlContent.replace(
    /(<w:t[^>]*>)([^<]*\{+[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*[}]+[^<]*?)(<\/w:t>)/g,
    '$1$2$3$4'
  );

  result = result.replace(
    /(<w:t[^>]*>)([^<]*\{\{[^}]*)<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*}}[^<]*?)(<\/w:t>)/g,
    '$1$2$3$4'
  );

  // Fix specific placeholders that might be split
  // Optimized: only process if we have placeholders
  if (placeholders.length > 0) {
    for (const placeholder of placeholders) {
      const parts = placeholder.split('');
      for (let i = 1; i < parts.length; i++) {
        const firstPart = '{{' + parts.slice(0, i).join('');
        const secondPart = parts.slice(i).join('') + '}}';
        const pattern = new RegExp(
          `(<w:t[^>]*>)([^<]*${firstPart.replace(/[{}]/g, '\\$&')})<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>([^<]*${secondPart.replace(/[{}]/g, '\\$&')}[^<]*?)(<\/w:t>)`,
          'g'
        );
        result = result.replace(pattern, '$1$2$3$4');
      }
    }
  }

  return result;
}

/**
 * Unescape XML entities back to characters
 */
function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Read custom properties from a Word document
 * Uses regex parsing to work in Web Worker context (no DOMParser available)
 */
export function readCustomPropertiesFromZip(zip: PizZip): Record<string, string> {
  const customPropsFile = zip.file("docProps/custom.xml");

  if (!customPropsFile) {
    return {};
  }

  const xmlContent = customPropsFile.asText();
  const properties: Record<string, string> = {};

  // Match all property elements with their name attribute and content
  const propertyRegex = /<property[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/property>/gi;
  let match;

  while ((match = propertyRegex.exec(xmlContent)) !== null) {
    const name = unescapeXml(match[1]);
    const propertyContent = match[2];

    // Extract value from various value type tags
    const valueMatch = propertyContent.match(/<vt:(lpwstr|i4|r8|bool)[^>]*>([^<]*)<\/vt:\1>/i);
    if (valueMatch) {
      properties[name] = unescapeXml(valueMatch[2]);
    }
  }

  return properties;
}

/**
 * Write custom properties to a Word document
 */
export function writeCustomPropertiesToZip(
  zip: PizZip,
  properties: Record<string, string>
): void {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ';
  xml += 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">\n';

  let pid = 2;
  for (const [name, value] of Object.entries(properties)) {
    xml += `  <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${pid}" name="${escapeXml(name)}">\n`;
    xml += `    <vt:lpwstr>${escapeXml(value)}</vt:lpwstr>\n`;
    xml += `  </property>\n`;
    pid++;
  }

  xml += '</Properties>';
  zip.file("docProps/custom.xml", xml);
}

/**
 * Extract placeholders from document XML
 * Uses regex parsing to work in Web Worker context (no DOMParser available)
 */
export function extractPlaceholdersFromZip(zip: PizZip): string[] {
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    return [];
  }

  const xmlContent = documentXml.asText();

  // Extract all text content from <w:t> tags using regex
  const textTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
  let reconstructedText = "";
  let match;

  while ((match = textTagRegex.exec(xmlContent)) !== null) {
    reconstructedText += match[1];
  }

  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const matches = reconstructedText.match(placeholderRegex) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/**
 * Process a document with the given data
 * Returns the processed document as a Blob
 */
export function processDocumentSync(
  arrayBuffer: ArrayBuffer,
  placeholderData: Record<string, string>,
  customPropsData: Record<string, string>,
  placeholders: string[],
  onProgress?: (stage: string, percent: number) => void
): Blob {
  onProgress?.('loading', 0);
  const zip = new PizZip(arrayBuffer);
  onProgress?.('loading', 100);

  // Update custom properties
  if (Object.keys(customPropsData).length > 0) {
    onProgress?.('updating_fields', 0);
    writeCustomPropertiesToZip(zip, customPropsData);
    updateDocumentFieldsOptimized(zip, customPropsData, (percent) => {
      onProgress?.('updating_fields', percent);
    });
  }

  // Process placeholders
  if (placeholders.length > 0) {
    onProgress?.('fixing_placeholders', 0);

    const documentXml = zip.file("word/document.xml");
    if (documentXml) {
      let xmlContent = documentXml.asText();
      xmlContent = fixSplitPlaceholders(xmlContent, placeholders);
      zip.file("word/document.xml", xmlContent);
    }
    onProgress?.('fixing_placeholders', 100);

    onProgress?.('rendering', 0);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ""
    });

    doc.setData(placeholderData);
    doc.render();
    onProgress?.('rendering', 100);
  }

  onProgress?.('generating', 0);
  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Blob;
  onProgress?.('generating', 100);

  return blob;
}
