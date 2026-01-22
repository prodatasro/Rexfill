/**
 * Optimized document processing functions for Web Worker
 * These are pure functions that can run in a worker context
 */

import PizZip from "pizzip";
import { escapeXml, unescapeXml, escapeRegex } from "./xmlUtils";

// Re-export for backwards compatibility
export { escapeXml, escapeRegex };

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
 * Process a document with the given custom properties data
 * Returns the processed document as a Blob
 */
export function processDocumentSync(
  arrayBuffer: ArrayBuffer,
  customPropsData: Record<string, string>,
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

  onProgress?.('generating', 0);
  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }) as Blob;
  onProgress?.('generating', 100);

  return blob;
}
