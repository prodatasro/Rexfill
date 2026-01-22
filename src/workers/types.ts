/**
 * Worker message types for document processing
 */

export type ProcessingStage =
  | 'loading'
  | 'parsing'
  | 'updating_fields'
  | 'generating';

export interface ProcessDocumentRequest {
  type: 'PROCESS_DOCUMENT';
  payload: {
    arrayBuffer: ArrayBuffer;
    customPropsData: Record<string, string>;
  };
}

export interface ExtractCustomPropertiesRequest {
  type: 'EXTRACT_CUSTOM_PROPERTIES';
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

export interface ExtractCustomPropertiesResponse {
  type: 'EXTRACT_COMPLETE';
  payload: {
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

export type WorkerRequest = ProcessDocumentRequest | ExtractCustomPropertiesRequest;
export type WorkerResponse = ProcessDocumentResponse | ExtractCustomPropertiesResponse | ProgressUpdate | ErrorResponse;
