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
// Longer timeout for file uploads (60 seconds)
const UPLOAD_TIMEOUT = 60000;

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
 * Uses longer timeout for file uploads (60 seconds)
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
