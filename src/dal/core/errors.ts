/**
 * Base error class for DAL operations
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Thrown when a document is not found
 */
export class NotFoundError extends RepositoryError {
  constructor(collection: string, key: string) {
    super(
      `Document not found in collection '${collection}' with key '${key}'`,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when there's a version conflict
 */
export class VersionConflictError extends RepositoryError {
  constructor(collection: string, key: string) {
    super(
      `Version conflict when updating document in '${collection}' with key '${key}'`,
      'VERSION_CONFLICT'
    );
    this.name = 'VersionConflictError';
  }
}

/**
 * Thrown when an operation times out
 */
export class TimeoutError extends RepositoryError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'TIMEOUT'
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when validation fails
 */
export class ValidationError extends RepositoryError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
