/**
 * Retry Utility for Transient Errors
 * Provides retry logic with exponential backoff for transient errors
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if an error is retryable
   */
  isRetryable?: (error: any) => boolean;

  /**
   * Function to call on each retry attempt
   */
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<
  Omit<RetryOptions, 'isRetryable' | 'onRetry'>
> & {
  isRetryable: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
} = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: (error: any) => {
    // Default: retry on network errors, timeouts, and 5xx errors
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
      return true;
    }
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    if (error?.message?.includes('timeout')) {
      return true;
    }
    return false;
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!opts.isRetryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt, error);
      }

      // Wait before retrying with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator for methods
 */
export function Retryable(options?: RetryOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
