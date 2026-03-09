/**
 * Supabase Database Error Handling
 * 
 * Provides utilities for handling database errors gracefully
 */

/**
 * Database Error Types
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public isConnectionError: boolean = false
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Handle Supabase/PostgreSQL errors and convert to user-friendly messages
 * 
 * @param error - Error from Supabase query
 * @returns DatabaseError with user-friendly message
 */
export function handleDatabaseError(error: any): DatabaseError {
  // PostgreSQL error codes
  const pgCode = error?.code || error?.error_code;
  const message = error?.message || 'Database operation failed';

  // Connection errors
  if (
    pgCode === 'ECONNREFUSED' ||
    pgCode === 'ETIMEDOUT' ||
    message.includes('connection') ||
    message.includes('timeout')
  ) {
    return new DatabaseError(
      'Database connection failed. Please try again later.',
      'CONNECTION_ERROR',
      true
    );
  }

  // Not found (PGRST116 is Supabase's "no rows returned" code)
  if (pgCode === 'PGRST116') {
    return new DatabaseError(
      'Resource not found',
      'NOT_FOUND',
      false
    );
  }

  // Unique constraint violation (23505)
  if (pgCode === '23505') {
    return new DatabaseError(
      'A record with this information already exists',
      'DUPLICATE_RECORD',
      false
    );
  }

  // Foreign key violation (23503)
  if (pgCode === '23503') {
    return new DatabaseError(
      'Cannot perform this operation due to related records',
      'FOREIGN_KEY_VIOLATION',
      false
    );
  }

  // Check constraint violation (23514)
  if (pgCode === '23514') {
    return new DatabaseError(
      'Invalid data provided',
      'CONSTRAINT_VIOLATION',
      false
    );
  }

  // Row-level security violation (42501)
  if (pgCode === '42501') {
    return new DatabaseError(
      'You do not have permission to access this resource',
      'PERMISSION_DENIED',
      false
    );
  }

  // Generic database error
  return new DatabaseError(
    'A database error occurred. Please try again later.',
    'DATABASE_ERROR',
    false
  );
}

/**
 * Check if an error is a database connection error
 */
export function isConnectionError(error: any): boolean {
  if (error instanceof DatabaseError) {
    return error.isConnectionError;
  }
  
  const message = error?.message || '';
  const code = error?.code || error?.error_code || '';
  
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    message.includes('connection') ||
    message.includes('timeout')
  );
}
