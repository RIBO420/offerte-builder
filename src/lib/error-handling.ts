/**
 * Error Handling Utilities
 *
 * Provides consistent error handling patterns across the application.
 */

import * as Sentry from "@sentry/nextjs";

// Custom error types for better categorization
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} met ID ${id} niet gevonden` : `${resource} niet gevonden`,
      "NOT_FOUND",
      404
    );
    this.name = "NotFoundError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Niet ingelogd") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Geen toegang") {
    super(message, "AUTHORIZATION_ERROR", 403);
    this.name = "AuthorizationError";
  }
}

// Error handler for async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: {
    operationName?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    throw error;
  }
}

// Central error handler
export function handleError(
  error: unknown,
  context?: {
    operationName?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
): void {
  const { logger } = Sentry;

  if (error instanceof AppError) {
    // Operational errors - expected, log with context
    if (error.isOperational) {
      logger.warn(logger.fmt`Operational error: ${error.message}`, {
        code: error.code,
        statusCode: error.statusCode,
        ...context,
      });
    } else {
      // Programming errors - unexpected, capture in Sentry
      Sentry.captureException(error, {
        tags: {
          errorCode: error.code,
          operationName: context?.operationName,
        },
        user: context?.userId ? { id: context.userId } : undefined,
        extra: context?.extra,
      });
    }
  } else if (error instanceof Error) {
    // Unknown errors - capture in Sentry
    Sentry.captureException(error, {
      tags: {
        operationName: context?.operationName,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.extra,
    });
  } else {
    // Non-Error thrown - capture with context
    Sentry.captureMessage("Non-Error thrown", {
      level: "error",
      extra: {
        thrownValue: error,
        ...context,
      },
    });
  }
}

// User-friendly error messages
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof NotFoundError) {
    return error.message;
  }

  if (error instanceof AuthenticationError) {
    return "Je bent niet ingelogd. Log opnieuw in.";
  }

  if (error instanceof AuthorizationError) {
    return "Je hebt geen toegang tot deze functie.";
  }

  if (error instanceof AppError) {
    return error.isOperational
      ? error.message
      : "Er is een fout opgetreden. Probeer het later opnieuw.";
  }

  // Generic error message for unknown errors
  return "Er is een onverwachte fout opgetreden. Probeer het later opnieuw.";
}

// Retry utility for transient failures
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or if shouldRetry returns false
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError;
}

// Toast-friendly error handler for mutations
export function getMutationErrorMessage(error: unknown): string {
  // Convex errors often have a message property
  if (error instanceof Error) {
    // Check for Convex validation errors
    if (error.message.includes("Validation")) {
      return "Ongeldige gegevens. Controleer de invoer.";
    }

    // Check for network errors
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Netwerkfout. Controleer je internetverbinding.";
    }

    // Return the error message for operational errors
    if (error instanceof AppError && error.isOperational) {
      return error.message;
    }
  }

  return "Er is een fout opgetreden. Probeer het later opnieuw.";
}
