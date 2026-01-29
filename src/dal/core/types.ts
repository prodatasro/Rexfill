import type { Doc } from '@junobuild/core';

/**
 * Generic query options for repository methods
 */
export interface QueryOptions {
  owner?: string;
  matcher?: {
    key?: string;
    description?: string;
  };
  order?: {
    desc: boolean;
    field: 'keys' | 'updated_at' | 'created_at';
  };
  paginate?: {
    startAfter?: string;
    limit?: number;
  };
}

/**
 * Paginated result wrapper
 */
export interface PaginationResult<T> {
  items: Array<Doc<T>>;
  hasMore: boolean;
  nextKey?: string;
  totalCount?: number;
}

/**
 * Repository interface for type safety
 */
export interface IRepository<T> {
  create(key: string, data: T, owner?: string): Promise<Doc<T>>;
  update(key: string, data: Partial<T>, currentVersion?: bigint): Promise<Doc<T>>;
  get(key: string): Promise<Doc<T> | undefined>;
  list(options?: QueryOptions): Promise<Array<Doc<T>>>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Storage interface for file operations
 */
export interface IStorage {
  upload(path: string, file: File | Blob, onProgress?: (progress: number) => void): Promise<void>;
  delete(path: string): Promise<void>;
  list(options?: { owner?: string; startAfter?: string; limit?: number }): Promise<any[]>;
}
