import { ErrorContext, Errors } from '../errors/errors';

export type PgNumericValue = number | string | null | undefined;
export type PgTimestampValue = Date | string | null | undefined;

function buildFieldContext(
  operation: string,
  field: string,
  context?: ErrorContext,
): ErrorContext {
  return {
    ...context,
    operation,
    field,
  };
}

function createFieldError(
  operation: string,
  field: string,
  context?: ErrorContext,
) {
  return Errors.database(`Unexpected database value for '${field}'.`, {
    context: buildFieldContext(operation, field, context),
  });
}

export function readString(
  value: unknown,
  field: string,
  operation: string,
  context?: ErrorContext,
): string {
  if (typeof value === 'string') {
    return value;
  }

  throw createFieldError(operation, field, context);
}

export function readNullableString(
  value: unknown,
  field: string,
  operation: string,
  context?: ErrorContext,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return readString(value, field, operation, context);
}

export function readNumber(
  value: PgNumericValue,
  field: string,
  operation: string,
  context?: ErrorContext,
): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  throw createFieldError(operation, field, context);
}

export function readNullableNumber(
  value: PgNumericValue,
  field: string,
  operation: string,
  context?: ErrorContext,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return readNumber(value, field, operation, context);
}

export function readDate(
  value: PgTimestampValue,
  field: string,
  operation: string,
  context?: ErrorContext,
): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw createFieldError(operation, field, context);
}

export function readNullableDate(
  value: PgTimestampValue,
  field: string,
  operation: string,
  context?: ErrorContext,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return readDate(value, field, operation, context);
}

export function readStringArray(
  value: unknown,
  field: string,
  operation: string,
  context?: ErrorContext,
): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  throw createFieldError(operation, field, context);
}

export function readRecordOrEmpty(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
