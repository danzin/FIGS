import {
  AppError,
  ErrorContext,
  Errors,
  getErrorMessage,
  isAppError,
  toErrorResponse,
} from "@financialsignalsgatheringsystem/common";

export function toServiceError(
  error: unknown,
  context: ErrorContext,
  message?: string,
): AppError {
  if (isAppError(error)) {
    return error;
  }

  return Errors.internal(message ?? getErrorMessage(error), {
    cause: error,
    context,
  });
}

export function logServiceError(
  label: string,
  error: unknown,
  context: ErrorContext,
): AppError {
  const appError = toServiceError(error, context);
  console.error(label, toErrorResponse(appError, { includeDebugInfo: true }));
  return appError;
}
