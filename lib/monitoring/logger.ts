/**
 * Structured JSON Logging
 * 
 * Provides consistent logging format across:
 * - API requests
 * - Inngest jobs
 * - GitHub API calls
 * - AI model calls
 * - E2B sandbox events
 * 
 * All logs include:
 * - timestamp (ISO 8601)
 * - log level (debug, info, warn, error)
 * - correlation_id (for tracing requests)
 * - sanitized data (no tokens, API keys, passwords)
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlation_id: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Sensitive patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36}/g,  // GitHub personal access tokens
  /gho_[a-zA-Z0-9]{36}/g,  // GitHub OAuth tokens
  /ghs_[a-zA-Z0-9]{36}/g,  // GitHub server tokens
  /sk-[a-zA-Z0-9]{48}/g,   // OpenAI API keys
  /AIza[a-zA-Z0-9_-]{35}/g, // Google API keys
  /Bearer\s+[a-zA-Z0-9_-]+/g, // Bearer tokens
  /password["\s:=]+[^\s"]+/gi, // Password fields
  /api[_-]?key["\s:=]+[^\s"]+/gi, // API key fields
];

/**
 * Sanitize sensitive data from log context
 */
function sanitize(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data;
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive keys entirely
      if (/token|key|secret|password|auth/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Logger class with correlation ID support
 */
export class Logger {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || randomUUID();
  }

  /**
   * Create a child logger with the same correlation ID
   */
  child(): Logger {
    return new Logger(this.correlationId);
  }

  /**
   * Get the correlation ID for this logger
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Log a message with context
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlation_id: this.correlationId,
      message,
      context: context ? sanitize(context) as Record<string, unknown> : undefined,
    };

    // In production, write to stdout as JSON
    // In development, pretty-print for readability
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(correlationId?: string): Logger {
  return new Logger(correlationId);
}

/**
 * API Request Logger
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('API request', {
    method,
    path,
    status_code: statusCode,
    duration_ms: durationMs,
    user_id: userId,
  });
}

/**
 * Inngest Job Logger
 */
export function logInngestJobStart(
  jobId: string,
  eventType: string,
  payload: Record<string, unknown>,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('Inngest job started', {
    job_id: jobId,
    event_type: eventType,
    payload: sanitize(payload),
  });
}

export function logInngestJobComplete(
  jobId: string,
  status: 'success' | 'failed',
  durationMs: number,
  result?: Record<string, unknown>,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('Inngest job completed', {
    job_id: jobId,
    status,
    duration_ms: durationMs,
    result: result ? sanitize(result) : undefined,
  });
}

export function logInngestJobFailure(
  jobId: string,
  error: Error,
  stackTrace?: string,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.error('Inngest job failed', {
    job_id: jobId,
    error_message: error.message,
    error_name: error.name,
    stack_trace: stackTrace,
  });
}

/**
 * GitHub API Call Logger
 */
export function logGitHubApiCall(
  endpoint: string,
  statusCode: number,
  rateLimitRemaining: number,
  durationMs: number,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('GitHub API call', {
    endpoint,
    status_code: statusCode,
    rate_limit_remaining: rateLimitRemaining,
    duration_ms: durationMs,
  });
}

/**
 * AI Model Call Logger
 */
export function logAiModelCall(
  modelName: string,
  tokenCount: number,
  latencyMs: number,
  success: boolean,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('AI model call', {
    model_name: modelName,
    token_count: tokenCount,
    latency_ms: latencyMs,
    success,
  });
}

/**
 * E2B Sandbox Event Logger
 */
export function logE2bSandboxEvent(
  event: 'create' | 'destroy',
  sandboxId: string,
  durationMs?: number,
  correlationId?: string
) {
  const logger = createLogger(correlationId);
  logger.info('E2B sandbox event', {
    event,
    sandbox_id: sandboxId,
    duration_ms: durationMs,
  });
}

/**
 * Default logger instance for convenience
 */
export const logger = createLogger();
