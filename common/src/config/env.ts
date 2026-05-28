import { ErrorContext, Errors } from "../errors/errors";

export interface GetEnvOptions<T> {
  required?: boolean;
  defaultValue?: T;
  parse?: (value: string) => T;
  env?: NodeJS.ProcessEnv;
  context?: ErrorContext;
}

export function parseIntegerEnv(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Expected an integer, received '${value}'.`);
  }

  return parsed;
}

export function getEnv<T>(
  key: string,
  options: GetEnvOptions<T> & { defaultValue: T },
): T;
export function getEnv<T>(
  key: string,
  options: GetEnvOptions<T> & { required: true },
): T;
export function getEnv<T = string>(
  key: string,
  options?: GetEnvOptions<T>,
): T | undefined;

export function getEnv<T = string>(
  key: string,
  options: GetEnvOptions<T> = {},
): T | undefined {
  const env = options.env ?? process.env;
  const required = options.required ?? options.defaultValue === undefined;
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === "") {
    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }

    if (required) {
      throw Errors.configuration(
        `Missing required environment variable: ${key}.`,
        {
          context: {
            ...options.context,
            field: key,
            operation: "getEnv",
          },
        },
      );
    }

    return undefined;
  }

  if (!options.parse) {
    return rawValue as T;
  }

  try {
    return options.parse(rawValue);
  } catch (error) {
    throw Errors.configuration(
      `Invalid value for environment variable: ${key}.`,
      {
        cause: error,
        context: {
          ...options.context,
          field: key,
          operation: "getEnv",
          value: rawValue,
        },
      },
    );
  }
}
