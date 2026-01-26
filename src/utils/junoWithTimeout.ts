/**
 * Juno SDK operations wrapped with timeout protection
 * Uses withTimeout from fetchWithTimeout.ts to prevent indefinite hangs
 */

import { withTimeout } from './fetchWithTimeout';
import {
  listDocs,
  setDoc,
  deleteDoc,
  uploadFile,
  deleteAsset,
  listAssets,
  getDoc,
} from '@junobuild/core';

// Default timeout for Juno operations (30 seconds)
const JUNO_TIMEOUT = 30000;
// Longer timeout for file uploads (120 seconds - increased for large files)
const UPLOAD_TIMEOUT = 120000;

/**
 * listDocs with timeout protection
 */
export async function listDocsWithTimeout<D>(
  ...args: Parameters<typeof listDocs<D>>
): Promise<Awaited<ReturnType<typeof listDocs<D>>>> {
  return withTimeout(
    listDocs<D>(...args),
    JUNO_TIMEOUT,
    'listDocs operation timed out'
  );
}

/**
 * setDoc with timeout protection
 */
export async function setDocWithTimeout<D>(
  ...args: Parameters<typeof setDoc<D>>
): Promise<Awaited<ReturnType<typeof setDoc<D>>>> {
  return withTimeout(
    setDoc<D>(...args),
    JUNO_TIMEOUT,
    'setDoc operation timed out'
  );
}

/**
 * deleteDoc with timeout protection
 */
export async function deleteDocWithTimeout<D>(
  ...args: Parameters<typeof deleteDoc<D>>
): Promise<void> {
  return withTimeout(
    deleteDoc<D>(...args),
    JUNO_TIMEOUT,
    'deleteDoc operation timed out'
  );
}

/**
 * uploadFile with timeout protection
 * Uses longer timeout for file uploads (120 seconds)
 */
export async function uploadFileWithTimeout(
  ...args: Parameters<typeof uploadFile>
): Promise<Awaited<ReturnType<typeof uploadFile>>> {
  return withTimeout(
    uploadFile(...args),
    UPLOAD_TIMEOUT,
    'uploadFile operation timed out'
  );
}

/**
 * uploadFile with retry logic for large files
 * Retries up to 5 times with exponential backoff on batch commit errors
 */
export async function uploadFileWithRetry(
  ...args: Parameters<typeof uploadFile>
): Promise<Awaited<ReturnType<typeof uploadFile>>> {
  const maxRetries = 5;
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries}...`);
      const result = await uploadFileWithTimeout(...args);
      console.log(`Upload succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a batch commit error or rejection
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);
      const isBatchError = errorMessage.includes('cannot_commit_batch') || 
                          errorMessage.includes('RejectError') ||
                          errorMessage.includes('Reject code: 5') ||
                          errorString.includes('cannot_commit_batch');
      
      console.error(`Upload attempt ${attempt} failed:`, error);
      
      // If it's the last attempt, throw immediately
      if (attempt === maxRetries) {
        console.error('All upload attempts failed');
        throw error;
      }
      
      // If not a batch error and not the last attempt, still retry (might be network issue)
      // Wait with exponential backoff before retry (2s, 4s, 8s, 16s)
      const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
      console.warn(`Retrying upload in ${backoffMs}ms... (${isBatchError ? 'batch error' : 'other error'})`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * deleteAsset with timeout protection
 */
export async function deleteAssetWithTimeout(
  ...args: Parameters<typeof deleteAsset>
): Promise<void> {
  return withTimeout(
    deleteAsset(...args),
    JUNO_TIMEOUT,
    'deleteAsset operation timed out'
  );
}

/**
 * listAssets with timeout protection
 */
export async function listAssetsWithTimeout(
  ...args: Parameters<typeof listAssets>
): Promise<Awaited<ReturnType<typeof listAssets>>> {
  return withTimeout(
    listAssets(...args),
    JUNO_TIMEOUT,
    'listAssets operation timed out'
  );
}

/**
 * getDoc with timeout protection
 */
export async function getDocWithTimeout<D>(
  ...args: Parameters<typeof getDoc<D>>
): Promise<Awaited<ReturnType<typeof getDoc<D>>>> {
  return withTimeout(
    getDoc<D>(...args),
    JUNO_TIMEOUT,
    'getDoc operation timed out'
  );
}
