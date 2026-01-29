import { setDoc, getDoc, listDocs, deleteDoc } from '@junobuild/core';
import type { Doc } from '@junobuild/core';
import type { QueryOptions, IRepository, PaginationResult } from './types';
import { RepositoryError, NotFoundError, TimeoutError, VersionConflictError } from './errors';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Generic base repository with common CRUD operations
 */
export abstract class BaseRepository<T> implements IRepository<T> {
  constructor(protected readonly collectionName: string) {}

  /**
   * Wrap an async operation with timeout protection
   */
  protected async withTimeout<R>(
    operation: Promise<R>,
    timeoutMs: number = DEFAULT_TIMEOUT,
    operationName: string = 'operation'
  ): Promise<R> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(operationName, timeoutMs)),
        timeoutMs
      )
    );

    try {
      return await Promise.race([operation, timeoutPromise]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to execute ${operationName}`,
        'OPERATION_FAILED',
        error
      );
    }
  }

  /**
   * Create a new document
   */
  async create(key: string, data: T, owner?: string): Promise<Doc<T>> {
    try {
      const doc = await this.withTimeout(
        setDoc<T>({
          collection: this.collectionName,
          doc: {
            key,
            data: data as any,
            ...(owner && { owner })
          }
        }),
        DEFAULT_TIMEOUT,
        `create document in ${this.collectionName}`
      );
      return doc;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to create document in ${this.collectionName}`,
        'CREATE_FAILED',
        error
      );
    }
  }

  /**
   * Update an existing document
   */
  async update(
    key: string,
    data: Partial<T>,
    currentVersion?: bigint
  ): Promise<Doc<T>> {
    try {
      const doc = await this.withTimeout(
        setDoc<T>({
          collection: this.collectionName,
          doc: {
            key,
            data: data as any,
            ...(currentVersion !== undefined && { version: currentVersion })
          }
        }),
        DEFAULT_TIMEOUT,
        `update document in ${this.collectionName}`
      );
      return doc;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof RepositoryError) {
        throw error;
      }
      // Check for version conflict
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message).toLowerCase();
        if (message.includes('version') || message.includes('conflict')) {
          throw new VersionConflictError(this.collectionName, key);
        }
      }
      throw new RepositoryError(
        `Failed to update document in ${this.collectionName}`,
        'UPDATE_FAILED',
        error
      );
    }
  }

  /**
   * Get a document by key
   */
  async get(key: string): Promise<Doc<T> | undefined> {
    try {
      const doc = await this.withTimeout(
        getDoc<T>({
          collection: this.collectionName,
          key
        }),
        DEFAULT_TIMEOUT,
        `get document from ${this.collectionName}`
      );
      return doc;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to get document from ${this.collectionName}`,
        'GET_FAILED',
        error
      );
    }
  }

  /**
   * Get a document by key, throw if not found
   */
  async getOrThrow(key: string): Promise<Doc<T>> {
    const doc = await this.get(key);
    if (!doc) {
      throw new NotFoundError(this.collectionName, key);
    }
    return doc;
  }

  /**
   * List documents with optional filtering
   */
  async list(options?: QueryOptions): Promise<Array<Doc<T>>> {
    try {
      const { items } = await this.withTimeout(
        listDocs<T>({
          collection: this.collectionName,
          filter: {
            ...(options?.owner && { owner: options.owner }),
            ...(options?.matcher && { matcher: options.matcher }),
            ...(options?.order && { order: options.order }),
            ...(options?.paginate && { paginate: options.paginate })
          }
        }),
        DEFAULT_TIMEOUT,
        `list documents from ${this.collectionName}`
      );
      return items;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to list documents from ${this.collectionName}`,
        'LIST_FAILED',
        error
      );
    }
  }

  /**
   * List documents with pagination support
   */
  async listPaginated(options?: QueryOptions): Promise<PaginationResult<T>> {
    try {
      const result = await this.withTimeout(
        listDocs<T>({
          collection: this.collectionName,
          filter: {
            ...(options?.owner && { owner: options.owner }),
            ...(options?.matcher && { matcher: options.matcher }),
            ...(options?.order && { order: options.order }),
            ...(options?.paginate && { paginate: options.paginate })
          }
        }),
        DEFAULT_TIMEOUT,
        `list paginated documents from ${this.collectionName}`
      );

      return {
        items: result.items,
        hasMore: result.items_page !== undefined,
        nextKey: result.items_page ? result.items[result.items.length - 1]?.key : undefined,
        totalCount: result.items_length ? Number(result.items_length) : undefined
      };
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to list paginated documents from ${this.collectionName}`,
        'LIST_PAGINATED_FAILED',
        error
      );
    }
  }

  /**
   * Delete a document
   */
  async delete(key: string): Promise<void> {
    try {
      await this.withTimeout(
        deleteDoc({
          collection: this.collectionName,
          doc: {
            key,
            data: {} as any
          }
        }),
        DEFAULT_TIMEOUT,
        `delete document from ${this.collectionName}`
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to delete document from ${this.collectionName}`,
        'DELETE_FAILED',
        error
      );
    }
  }

  /**
   * Check if a document exists
   */
  async exists(key: string): Promise<boolean> {
    const doc = await this.get(key);
    return doc !== undefined;
  }

  /**
   * Batch create/update multiple documents
   */
  protected async setMany(docs: Array<{ key: string; data: T; owner?: string }>): Promise<void> {
    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(doc => this.create(doc.key, doc.data, doc.owner))
      );
    }
  }
}
