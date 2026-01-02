import PizZip from "pizzip";

export interface CustomProperty {
  name: string;
  value: string;
}

/**
 * Read all custom properties from a Word document
 */
export function readCustomProperties(zip: PizZip): Record<string, string> {
  const customPropsFile = zip.file("docProps/custom.xml");

  if (!customPropsFile) {
    return {}; // No custom properties in this document
  }

  const xmlContent = customPropsFile.asText();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

  const properties: Record<string, string> = {};
  const propertyElements = xmlDoc.getElementsByTagName("property");

  for (let i = 0; i < propertyElements.length; i++) {
    const property = propertyElements[i];
    const name = property.getAttribute("name");

    // Get value from various possible value tags
    const lpwstr = property.getElementsByTagName("vt:lpwstr")[0];
    const i4 = property.getElementsByTagName("vt:i4")[0];
    const r8 = property.getElementsByTagName("vt:r8")[0];
    const bool = property.getElementsByTagName("vt:bool")[0];

    let value = "";
    if (lpwstr) {
      value = lpwstr.textContent || "";
    } else if (i4) {
      value = i4.textContent || "";
    } else if (r8) {
      value = r8.textContent || "";
    } else if (bool) {
      value = bool.textContent || "";
    }

    if (name) {
      properties[name] = value;
    }
  }

  return properties;
}

/**
 * Write custom properties to a Word document
 */
export function writeCustomProperties(
  zip: PizZip,
  properties: Record<string, string>
): void {
  // Always recreate the XML using string manipulation to avoid serialization issues
  const xmlContent = createCustomPropertiesXml(properties);

  // Write the updated XML back to the zip
  zip.file("docProps/custom.xml", xmlContent);
}

/**
 * Create a new custom.xml file with the given properties
 */
function createCustomPropertiesXml(properties: Record<string, string>): string {
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
  return xml;
}

/**
 * Escape special XML characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Update document fields after changing custom properties
 * This updates DOCPROPERTY field values in the document
 */
export function updateDocumentFields(zip: PizZip, properties: Record<string, string>): void {
  // Get all file paths that might contain fields
  const filePaths: string[] = [];

  // Add document.xml
  if (zip.file("word/document.xml")) {
    filePaths.push("word/document.xml");
  }

  // Add all header files
  Object.keys(zip.files).forEach(name => {
    if (name.match(/word\/header\d*\.xml/)) {
      filePaths.push(name);
    }
  });

  // Add all footer files
  Object.keys(zip.files).forEach(name => {
    if (name.match(/word\/footer\d*\.xml/)) {
      filePaths.push(name);
    }
  });

  console.log(`Processing ${filePaths.length} files for DOCPROPERTY fields:`, filePaths);

  filePaths.forEach(fileName => {
    const file = zip.file(fileName);
    if (!file) return;

    console.log(`Processing file: ${fileName}`);

    let xmlContent = file.asText();
    const originalLength = xmlContent.length;

    // For each custom property, update the cached field value
    Object.entries(properties).forEach(([propName, propValue]) => {
      console.log(`Updating DOCPROPERTY field: ${propName} = ${propValue}`);

      // Pattern 1: Simple fields - just update the text value inside
      const simpleFieldPattern = new RegExp(
        `(<w:fldSimple[^>]*w:instr="[^"]*DOCPROPERTY\\s+(?:&quot;)?\\s*${escapeRegex(propName)}\\s*(?:&quot;)?\\s*[^"]*"[^>]*>` +
        `<w:r[^>]*>(?:<w:rPr[^>]*>.*?</w:rPr>)?<w:t[^>]*>)[^<]*(</w:t></w:r></w:fldSimple>)`,
        'gi'
      );

      xmlContent = xmlContent.replace(simpleFieldPattern, (_match, before, after) => {
        console.log(`✓ Updated simple field for ${propName}`);
        return `${before}${escapeXml(propValue)}${after}`;
      });

      // Pattern 2: Complex fields - update the text between separate and end markers
      const complexFieldRegex = new RegExp(
        `(<w:fldChar w:fldCharType="begin"[^>]*/>` +
        `[\\s\\S]*?<w:instrText[^>]*>\\s*DOCPROPERTY\\s+(?:&quot;)?\\s*${escapeRegex(propName)}\\s*(?:&quot;)?\\s*[^<]*</w:instrText>` +
        `[\\s\\S]*?<w:fldChar w:fldCharType="separate"[^>]*/>)` +
        `([\\s\\S]*?)` +
        `(<w:fldChar w:fldCharType="end"[^>]*/>)`,
        'gi'
      );

      xmlContent = xmlContent.replace(complexFieldRegex, (_fullMatch, before, content, after) => {
        console.log(`✓ Updated complex field for ${propName}`);

        // Replace all text content between separate and end with new value
        // Keep the structure but replace text
        const newContent = content.replace(/(<w:t[^>]*>)[^<]*(<\/w:t>)/g, `$1${escapeXml(propValue)}$2`);

        return before + newContent + after;
      });
    });

    // Save changes - fileName is guaranteed to exist here
    const newLength = xmlContent.length;
    const bytesRemoved = originalLength - newLength;
    console.log(`File ${fileName}: ${originalLength} -> ${newLength} bytes (${bytesRemoved} bytes removed from field codes)`);
    zip.file(fileName, xmlContent);
  });
}

/**
 * Escape special characters for use in regular expressions
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
