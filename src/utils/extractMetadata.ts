import PizZip from 'pizzip';

interface ExtractedMetadata {
  placeholderCount: number;
  customPropertyCount: number;
}

/**
 * Extract metadata from an ArrayBuffer (shared logic)
 */
function extractMetadataFromArrayBuffer(arrayBuffer: ArrayBuffer): ExtractedMetadata {
  const zip = new PizZip(arrayBuffer);

  // Extract {{}} placeholders from document.xml
  let placeholderCount = 0;
  const documentXml = zip.file("word/document.xml");
  if (documentXml) {
    const xmlContent = documentXml.asText();
    const textTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
    let reconstructedText = "";
    let match;

    while ((match = textTagRegex.exec(xmlContent)) !== null) {
      reconstructedText += match[1];
    }

    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = reconstructedText.match(placeholderRegex) || [];
    // Count unique placeholders
    placeholderCount = new Set(matches.map(m => m.slice(2, -2).trim())).size;
  }

  // Extract custom properties from docProps/custom.xml
  let customPropertyCount = 0;
  const customPropsFile = zip.file("docProps/custom.xml");
  if (customPropsFile) {
    const customXml = customPropsFile.asText();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(customXml, "application/xml");
    const propertyElements = xmlDoc.getElementsByTagName("property");
    customPropertyCount = propertyElements.length;
  }

  return { placeholderCount, customPropertyCount };
}

/**
 * Extract placeholder and custom property counts from a DOCX file
 */
export async function extractMetadataFromFile(file: File): Promise<ExtractedMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return extractMetadataFromArrayBuffer(arrayBuffer);
  } catch (error) {
    console.error('Failed to extract metadata:', error);
    return { placeholderCount: 0, customPropertyCount: 0 };
  }
}

/**
 * Extract placeholder and custom property counts from a Blob
 */
export async function extractMetadataFromBlob(blob: Blob): Promise<ExtractedMetadata> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return extractMetadataFromArrayBuffer(arrayBuffer);
  } catch (error) {
    console.error('Failed to extract metadata from blob:', error);
    return { placeholderCount: 0, customPropertyCount: 0 };
  }
}
