import PizZip from 'pizzip';

interface ExtractedMetadata {
  customPropertyCount: number;
}

/**
 * Extract metadata from an ArrayBuffer (shared logic)
 */
function extractMetadataFromArrayBuffer(arrayBuffer: ArrayBuffer): ExtractedMetadata {
  const zip = new PizZip(arrayBuffer);

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

  return { customPropertyCount };
}

/**
 * Extract custom property count from a DOCX file
 */
export async function extractMetadataFromFile(file: File): Promise<ExtractedMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return extractMetadataFromArrayBuffer(arrayBuffer);
  } catch (error) {
    console.error('Failed to extract metadata:', error);
    return { customPropertyCount: 0 };
  }
}

/**
 * Extract custom property count from a Blob
 */
export async function extractMetadataFromBlob(blob: Blob): Promise<ExtractedMetadata> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return extractMetadataFromArrayBuffer(arrayBuffer);
  } catch (error) {
    console.error('Failed to extract metadata from blob:', error);
    return { customPropertyCount: 0 };
  }
}
