export interface ErrorContext {
  operation?: string;
  resourceType?: string;
  resourceId?: string;
  field?: string;
  service?: string;
  [key: string]: unknown;
}

export interface ErrorOptions {
  context?: ErrorContext;
  cause?: unknown;
  errorCode?: ErrorCode;
}

export enum ErrorCode {
  VALIDATION_FAILED = "VAL_2001",
  RESOURCE_NOT_FOUND = "RES_3001",
  CONFLICT = "CONF_4001",
  DATABASE_ERROR = "SRV_5002",
  INTERNAL_ERROR = "SRV_5001",
  UNKNOWN_ERROR = "SRV_5000",
  CONFIGURATION_ERROR = "CFG_7001",
}

export type ErrorType =
  | "ValidationError"
  | "NotFoundError"
  | "ConflictError"
  | "DatabaseError"
  | "InternalServerError"
  | "UnknownError"
  | "ConfigurationError";

export interface ErrorResponseBody {
  type: string;
  message: string;
  code: number;
  errorCode?: string;
  context?: ErrorContext;
  stack?: string;
  cause?: {
    message: string;
    stack?: string;
  };
}

interface ErrorDefinition {
  readonly statusCode: number;
  readonly errorCode: ErrorCode;
}

const errorDefinitions: Record<ErrorType, ErrorDefinition> = {
  ValidationError: {
    statusCode: 400,
    errorCode: ErrorCode.VALIDATION_FAILED,
  },
  NotFoundError: {
    statusCode: 404,
    errorCode: ErrorCode.RESOURCE_NOT_FOUND,
  },
  ConflictError: {
    statusCode: 409,
    errorCode: ErrorCode.CONFLICT,
  },
  DatabaseError: {
    statusCode: 500,
    errorCode: ErrorCode.DATABASE_ERROR,
  },
  InternalServerError: {
    statusCode: 500,
    errorCode: ErrorCode.INTERNAL_ERROR,
  },
  UnknownError: {
    statusCode: 500,
    errorCode: ErrorCode.UNKNOWN_ERROR,
  },
  ConfigurationError: {
    statusCode: 500,
    errorCode: ErrorCode.CONFIGURATION_ERROR,
  },
};

export class AppError extends Error {
  declare public cause?: unknown;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly errorCode?: ErrorCode;

  constructor(
    name: string,
    message: string,
    statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.context = options?.context;
    this.errorCode = options?.errorCode;

    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export function createError(
  type: ErrorType,
  message: string,
  options?: ErrorOptions,
): AppError {
  const definition = errorDefinitions[type] ?? errorDefinitions.UnknownError;

  return new AppError(type, message, definition.statusCode, {
    ...options,
    errorCode: options?.errorCode ?? definition.errorCode,
  });
}

export function wrapError(
  error: unknown,
  fallbackType: ErrorType = "InternalServerError",
  options?: Omit<ErrorOptions, "cause">,
): AppError {
  if (isAppError(error)) {
    return error;
  }

  const message =
    fallbackType === "InternalServerError"
      ? "An unexpected error occurred."
      : getErrorMessage(error);

  return createError(fallbackType, message, {
    ...options,
    cause: error,
  });
}

export function toErrorResponse(
  error: AppError,
  options: { includeDebugInfo?: boolean } = {},
): ErrorResponseBody {
  const includeDebugInfo = options.includeDebugInfo ?? false;

  return {
    type: error.name,
    message: error.message,
    code: error.statusCode,
    ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    ...(error.context ? { context: error.context } : {}),
    ...(includeDebugInfo && error.stack ? { stack: error.stack } : {}),
    ...(includeDebugInfo && error.cause instanceof Error
      ? {
          cause: {
            message: error.cause.message,
            ...(error.cause.stack ? { stack: error.cause.stack } : {}),
          },
        }
      : {}),
  };
}

export const Errors = {
  validation(message: string, options?: ErrorOptions): AppError {
    return createError("ValidationError", message, {
      ...options,
      errorCode: options?.errorCode ?? ErrorCode.VALIDATION_FAILED,
    });
  },

  notFound(
    resourceType: string,
    resourceId?: string,
    options?: Omit<ErrorOptions, "context"> & { context?: ErrorContext },
  ): AppError {
    const idSegment = resourceId ? ` with ID '${resourceId}'` : "";

    return createError(
      "NotFoundError",
      `${resourceType}${idSegment} not found.`,
      {
        ...options,
        context: {
          ...options?.context,
          resourceType,
          ...(resourceId ? { resourceId } : {}),
        },
        errorCode: options?.errorCode ?? ErrorCode.RESOURCE_NOT_FOUND,
      },
    );
  },

  conflict(message: string, options?: ErrorOptions): AppError {
    return createError("ConflictError", message, {
      ...options,
      errorCode: options?.errorCode ?? ErrorCode.CONFLICT,
    });
  },

  database(message: string, options?: ErrorOptions): AppError {
    return createError("DatabaseError", message, {
      ...options,
      errorCode: options?.errorCode ?? ErrorCode.DATABASE_ERROR,
    });
  },

  internal(message: string, options?: ErrorOptions): AppError {
    return createError("InternalServerError", message, {
      ...options,
      errorCode: options?.errorCode ?? ErrorCode.INTERNAL_ERROR,
    });
  },

  configuration(message: string, options?: ErrorOptions): AppError {
    return createError("ConfigurationError", message, {
      ...options,
      errorCode: options?.errorCode ?? ErrorCode.CONFIGURATION_ERROR,
    });
  },
};
