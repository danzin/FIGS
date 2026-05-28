import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AppError,
  ErrorContext,
  ErrorResponseBody,
  ErrorType,
  createError,
  isAppError,
  toErrorResponse,
  wrapError,
} from './errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const appError = this.normalizeException(exception);
    const includeDebugInfo = process.env.NODE_ENV !== 'production';

    const payload: ErrorResponseBody = toErrorResponse(appError, {
      includeDebugInfo,
    });

    this.logger.error(
      `${request.method} ${request.url} -> ${appError.statusCode} ${appError.name}: ${appError.message}`,
      appError.stack,
    );

    response.status(appError.statusCode).json({ error: payload });
  }

  private normalizeException(exception: unknown): AppError {
    if (isAppError(exception)) {
      return exception;
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    return wrapError(exception, 'InternalServerError');
  }

  private normalizeHttpException(exception: HttpException): AppError {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const { message, context } = this.extractResponseDetails(
      exceptionResponse,
      exception.message,
    );

    return createError(this.getErrorTypeForStatus(status), message, {
      cause: exception,
      context,
    });
  }

  private extractResponseDetails(
    response: string | object,
    fallbackMessage: string,
  ): { message: string; context?: ErrorContext } {
    if (typeof response === 'string') {
      return { message: response };
    }

    if (!response || typeof response !== 'object') {
      return { message: fallbackMessage };
    }

    const responseMessage =
      'message' in response ? response.message : undefined;

    if (Array.isArray(responseMessage)) {
      return {
        message: responseMessage.join(', '),
        context: { details: responseMessage },
      };
    }

    if (
      typeof responseMessage === 'string' &&
      responseMessage.trim().length > 0
    ) {
      return { message: responseMessage };
    }

    return { message: fallbackMessage };
  }

  private getErrorTypeForStatus(status: number): ErrorType {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'ValidationError';
      case HttpStatus.NOT_FOUND:
        return 'NotFoundError';
      case HttpStatus.CONFLICT:
        return 'ConflictError';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'InternalServerError';
      default:
        return status >= 500 ? 'InternalServerError' : 'UnknownError';
    }
  }
}
