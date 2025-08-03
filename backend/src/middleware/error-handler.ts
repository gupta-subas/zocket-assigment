import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createLogger } from '../utils/logger';
import { metrics } from './metrics';
import { config, isDevelopment } from '../config';

const logger = createLogger();

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly context?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    context?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.context = context;
    this.name = 'AppError';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(message || `${service} service unavailable`, 502, true, 'EXTERNAL_SERVICE_ERROR', { service });
    this.name = 'ExternalServiceError';
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string) {
    super(`Operation timed out: ${operation}`, 408, true, 'TIMEOUT_ERROR', { operation });
    this.name = 'TimeoutError';
  }
}

// Error classification and handling
class ErrorHandler {
  handleError(err: Error, req: Request, res: Response): void {
    const errorInfo = this.classifyError(err);
    
    // Log error
    this.logError(err, req, errorInfo);
    
    // Track metrics
    metrics.trackError(errorInfo.type, errorInfo.code);
    
    // Send response
    this.sendErrorResponse(res, errorInfo);
  }

  private classifyError(err: Error): {
    statusCode: number;
    message: string;
    code: string;
    type: string;
    details?: any;
  } {
    // App errors (our custom errors)
    if (err instanceof AppError) {
      return {
        statusCode: err.statusCode,
        message: err.message,
        code: err.code || 'APP_ERROR',
        type: err.name,
        details: isDevelopment ? err.context : undefined,
      };
    }

    // Validation errors (Zod)
    if (err instanceof ZodError) {
      return {
        statusCode: 400,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        type: 'ZodError',
        details: isDevelopment ? err.errors : undefined,
      };
    }

    // Database errors (Prisma)
    if (err instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(err);
    }

    // System errors
    if (err.name === 'TimeoutError') {
      return {
        statusCode: 408,
        message: 'Request timeout',
        code: 'TIMEOUT',
        type: 'TimeoutError',
      };
    }

    if (err.name === 'SyntaxError' && 'body' in err) {
      return {
        statusCode: 400,
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        type: 'SyntaxError',
      };
    }

    // Default unknown error
    return {
      statusCode: 500,
      message: isDevelopment ? err.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
      type: 'UnknownError',
      details: isDevelopment ? { stack: err.stack } : undefined,
    };
  }

  private handlePrismaError(err: PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    code: string;
    type: string;
    details?: any;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          statusCode: 409,
          message: 'A record with this data already exists',
          code: 'DUPLICATE_ENTRY',
          type: 'PrismaError',
          details: isDevelopment ? { fields: err.meta?.target } : undefined,
        };
      case 'P2025':
        return {
          statusCode: 404,
          message: 'Record not found',
          code: 'RECORD_NOT_FOUND',
          type: 'PrismaError',
        };
      case 'P2003':
        return {
          statusCode: 400,
          message: 'Foreign key constraint failed',
          code: 'FOREIGN_KEY_ERROR',
          type: 'PrismaError',
        };
      case 'P2014':
        return {
          statusCode: 400,
          message: 'Invalid ID provided',
          code: 'INVALID_ID',
          type: 'PrismaError',
        };
      default:
        return {
          statusCode: 500,
          message: isDevelopment ? err.message : 'Database operation failed',
          code: 'DATABASE_ERROR',
          type: 'PrismaError',
          details: isDevelopment ? { code: err.code } : undefined,
        };
    }
  }

  private logError(err: Error, req: Request, errorInfo: any): void {
    const logData = {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: errorInfo.code,
        statusCode: errorInfo.statusCode,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      timestamp: new Date().toISOString(),
    };

    if (errorInfo.statusCode >= 500) {
      logger.error('Server error occurred', logData);
    } else if (errorInfo.statusCode >= 400) {
      logger.warn('Client error occurred', logData);
    }
  }

  private sendErrorResponse(res: Response, errorInfo: any): void {
    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    });

    const response: any = {
      error: errorInfo.message,
      code: errorInfo.code,
      timestamp: new Date().toISOString(),
    };

    // Include additional details in development
    if (isDevelopment && errorInfo.details) {
      response.details = errorInfo.details;
    }

    // Add request ID if available
    if (res.locals.requestId) {
      response.requestId = res.locals.requestId;
    }

    res.status(errorInfo.statusCode).json(response);
  }
}

const errorHandler = new ErrorHandler();

// Express error handling middleware
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  errorHandler.handleError(err, req, res);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
  
  // Graceful shutdown
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });
  
  // Graceful shutdown
  process.exit(1);
});

// Graceful shutdown handler
export const setupGracefulShutdown = (server: any) => {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}; 