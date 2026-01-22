/**
 * Web Worker for document processing
 * Handles heavy document operations off the main thread
 */

import PizZip from 'pizzip';
import {
  processDocumentSync,
  readCustomPropertiesFromZip
} from '../utils/documentProcessing';
import type {
  WorkerRequest,
  WorkerResponse,
  ProgressUpdate,
  ProcessingStage
} from './types';

function postProgress(stage: ProcessingStage, progress: number) {
  self.postMessage({
    type: 'PROGRESS',
    payload: { stage, progress }
  } satisfies ProgressUpdate);
}

function postError(message: string, stage?: ProcessingStage) {
  self.postMessage({
    type: 'ERROR',
    payload: { message, stage }
  } satisfies WorkerResponse);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data;

  try {
    if (type === 'EXTRACT_CUSTOM_PROPERTIES') {
      postProgress('parsing', 0);

      const zip = new PizZip(payload.arrayBuffer);
      postProgress('parsing', 50);

      const customProperties = readCustomPropertiesFromZip(zip);
      postProgress('parsing', 100);

      self.postMessage({
        type: 'EXTRACT_COMPLETE',
        payload: { customProperties }
      } satisfies WorkerResponse);

    } else if (type === 'PROCESS_DOCUMENT') {
      const { arrayBuffer, customPropsData } = payload;

      const blob = processDocumentSync(
        arrayBuffer,
        customPropsData,
        (stage: string, percent: number) => {
          postProgress(stage as ProcessingStage, percent);
        }
      );

      self.postMessage({
        type: 'PROCESS_COMPLETE',
        payload: { blob }
      } satisfies WorkerResponse);
    }
  } catch (error) {
    postError(
      error instanceof Error ? error.message : 'Unknown error during processing'
    );
  }
};

export {};
