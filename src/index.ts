import { createPlugin, PluginOptions, HttpMethod } from 'endpoint-fetcher';

export type RetryStrategy = 'fixed' | 'exponential' | 'linear';

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Retry strategy to use (default: 'exponential') */
  strategy?: RetryStrategy;
  /** Custom retry condition function */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback for retry events */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** HTTP status codes that should trigger retry (default: [500, 502, 503, 504]) */
  retryStatusCodes?: number[];
  /** HTTP methods that should be retried (default: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) */
  retryMethods?: string[];
}

const defaultConfig: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  strategy: 'exponential',
  shouldRetry: (error: unknown) => {
    const err = error as { status?: number };
    return !err.status || err.status >= 500;
  },
  onRetry: () => {},
  retryStatusCodes: [500, 502, 503, 504, 429],
  retryMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
};

function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  strategy: RetryStrategy
): number {
  switch (strategy) {
    case 'fixed':
      return baseDelay;
    case 'linear':
      return Math.min(baseDelay * attempt, maxDelay);
    case 'exponential':
    default:
      return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  }
}

function shouldRetryRequest(
  error: unknown,
  config: Required<RetryConfig>,
  context?: { method?: HttpMethod }
): boolean {
  const err = error as { status?: number; statusText?: string };
  
  // Check custom retry condition
  if (config.shouldRetry && !config.shouldRetry(error, 0)) {
    return false;
  }
  
  // Check HTTP status code
  if (err.status && !config.retryStatusCodes.includes(err.status)) {
    return false;
  }
  
  // Check HTTP method if context is provided
  if (context?.method && !config.retryMethods.includes(context.method.toUpperCase())) {
    return false;
  }
  
  return true;
}

/**
 * Creates a retry plugin for endpoint-fetcher with configurable retry strategies.
 * 
 * @example
 * ```typescript
 * import { createApiClient } from 'endpoint-fetcher';
 * import { retryPlugin } from '@endpoint-fetcher/retry';
 * 
 * const api = createApiClient({
 *   users: get<void, User[]>('/users'),
 * }, {
 *   baseUrl: 'https://api.example.com',
 *   plugins: [
 *     retryPlugin({
 *       maxRetries: 3,
 *       strategy: 'exponential',
 *       baseDelay: 1000,
 *     }),
 *   ],
 * });
 * ```
 */
export const retryPlugin = createPlugin('retry', (config?: RetryConfig) => {
  const mergedConfig: Required<RetryConfig> = {
    ...defaultConfig,
    ...config,
    shouldRetry: config?.shouldRetry || defaultConfig.shouldRetry,
    onRetry: config?.onRetry || defaultConfig.onRetry,
    retryStatusCodes: config?.retryStatusCodes || defaultConfig.retryStatusCodes,
    retryMethods: config?.retryMethods || defaultConfig.retryMethods,
  };

  return {
    handlerWrapper: <TInput, TOutput, TError>(
      originalHandler: (input: TInput, context: {
        fetch: typeof fetch;
        method: HttpMethod;
        path: string;
        baseUrl: string;
      }) => Promise<TOutput>,
      endpoint: any
    ) => {
      return async (input: TInput, context: {
        fetch: typeof fetch;
        method: HttpMethod;
        path: string;
        baseUrl: string;
      }) => {
        let lastError: unknown;
        const { maxRetries, baseDelay, maxDelay, strategy, onRetry } = mergedConfig;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          try {
            return await originalHandler(input, context);
          } catch (error) {
            lastError = error;

            // Check if we should retry
            if (attempt <= maxRetries && shouldRetryRequest(error, mergedConfig, context)) {
              const delay = calculateDelay(attempt, baseDelay, maxDelay, strategy);
              
              // Call retry callback
              onRetry(error, attempt, delay);
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            
            // Don't retry or no more retries left
            throw error;
          }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError!;
      };
    },
  };
});

// Export default for convenience
export default retryPlugin;