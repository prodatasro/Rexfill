/**
 * Worker message types for document processing
 */

export type ProcessingStage =
  | 'loading'
  | 'parsing'
  | 'fixing_placeholders'
  | 'updating_fields'
  | 'rendering'
  | 'generating';

export interface ProcessDocumentRequest {
  type: 'PROCESS_DOCUMENT';
  payload: {
    arrayBuffer: ArrayBuffer;
    placeholderData: Record<string, string>;
    customPropsData: Record<string, string>;
    placeholders: string[];
  };
}

export interface ExtractPlaceholdersRequest {
  type: 'EXTRACT_PLACEHOLDERS';
  payload: {
    arrayBuffer: ArrayBuffer;
  };
}

export interface ProgressUpdate {
  type: 'PROGRESS';
  payload: {
    stage: ProcessingStage;
    progress: number; // 0-100
  };
}

export interface ProcessDocumentResponse {
  type: 'PROCESS_COMPLETE';
  payload: {
    blob: Blob;
  };
}

export interface ExtractPlaceholdersResponse {
  type: 'EXTRACT_COMPLETE';
  payload: {
    placeholders: string[];
    customProperties: Record<string, string>;
  };
}

export interface ErrorResponse {
  type: 'ERROR';
  payload: {
    message: string;
    stage?: ProcessingStage;
  };
}

export type WorkerRequest = ProcessDocumentRequest | ExtractPlaceholdersRequest;
export type WorkerResponse = ProcessDocumentResponse | ExtractPlaceholdersResponse | ProgressUpdate | ErrorResponse;
