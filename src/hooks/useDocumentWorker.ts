/**
 * Hook to manage document processing Web Worker
 * Provides promise-based API for document operations
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import type {
  WorkerRequest,
  WorkerResponse,
  ProcessingStage
} from '../workers/types';

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number;
}

interface PendingOperation {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export function useDocumentWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<PendingOperation | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  // Initialize worker on mount
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/documentProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      if (type === 'PROGRESS') {
        setProgress(payload);
      } else if (type === 'PROCESS_COMPLETE') {
        setProgress(null);
        if (pendingRef.current) {
          pendingRef.current.resolve(payload.blob);
          pendingRef.current = null;
        }
      } else if (type === 'EXTRACT_COMPLETE') {
        setProgress(null);
        if (pendingRef.current) {
          pendingRef.current.resolve(payload);
          pendingRef.current = null;
        }
      } else if (type === 'ERROR') {
        setProgress(null);
        if (pendingRef.current) {
          pendingRef.current.reject(new Error(payload.message));
          pendingRef.current = null;
        }
      }
    };

    workerRef.current.onerror = (error) => {
      setProgress(null);
      if (pendingRef.current) {
        pendingRef.current.reject(new Error(error.message || 'Worker error'));
        pendingRef.current = null;
      }
    };

    setIsWorkerReady(true);

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsWorkerReady(false);
    };
  }, []);

  const processDocument = useCallback((
    arrayBuffer: ArrayBuffer,
    placeholderData: Record<string, string>,
    customPropsData: Record<string, string>,
    placeholders: string[]
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      pendingRef.current = { resolve: resolve as (v: unknown) => void, reject };

      const request: WorkerRequest = {
        type: 'PROCESS_DOCUMENT',
        payload: { arrayBuffer, placeholderData, customPropsData, placeholders }
      };

      // Transfer ArrayBuffer ownership for better performance
      workerRef.current.postMessage(request, [arrayBuffer]);
    });
  }, []);

  const extractPlaceholders = useCallback((
    arrayBuffer: ArrayBuffer
  ): Promise<{ placeholders: string[]; customProperties: Record<string, string> }> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      pendingRef.current = { resolve: resolve as (v: unknown) => void, reject };

      const request: WorkerRequest = {
        type: 'EXTRACT_PLACEHOLDERS',
        payload: { arrayBuffer }
      };

      // Transfer ArrayBuffer ownership for better performance
      workerRef.current.postMessage(request, [arrayBuffer]);
    });
  }, []);

  return {
    processDocument,
    extractPlaceholders,
    progress,
    isWorkerReady
  };
}
