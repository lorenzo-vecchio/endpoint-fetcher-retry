# @endpoint-fetcher/retry

A configurable retry plugin for [endpoint-fetcher](https://endpoint-fetcher.lorenzovecchio.dev/) with multiple retry strategies and advanced configuration options.

## Installation

```bash
npm install @endpoint-fetcher/retry
```

## Quick Start

```typescript
import { createApiClient, get } from 'endpoint-fetcher';
import { retryPlugin } from '@endpoint-fetcher/retry';

type User = {
  id: string;
  name: string;
  email: string;
};

const api = createApiClient({
  users: get<void, User[]>('/users'),
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    retryPlugin({
      maxRetries: 3,
      strategy: 'exponential',
      baseDelay: 1000,
    }),
  ],
});

// The API will automatically retry failed requests
const users = await api.users();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum number of retry attempts |
| `baseDelay` | `number` | `1000` | Base delay in milliseconds |
| `maxDelay` | `number` | `30000` | Maximum delay in milliseconds |
| `strategy` | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | Retry strategy to use |
| `shouldRetry` | `(error: unknown, attempt: number) => boolean` | Checks for 5xx status codes | Custom retry condition function |
| `onRetry` | `(error: unknown, attempt: number, delay: number) => void` | `() => {}` | Callback for retry events |
| `retryStatusCodes` | `number[]` | `[500, 502, 503, 504]` | HTTP status codes that should trigger retry |
| `retryMethods` | `string[]` | `['GET', 'POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods that should be retried |

## Retry Strategies

### Fixed Delay
```typescript
retryPlugin({
  strategy: 'fixed',
  baseDelay: 1000, // Always wait 1 second between retries
  maxRetries: 3,
})
```

### Linear Backoff
```typescript
retryPlugin({
  strategy: 'linear',
  baseDelay: 1000, // 1s, 2s, 3s, ...
  maxRetries: 3,
})
```

### Exponential Backoff (Default)
```typescript
retryPlugin({
  strategy: 'exponential',
  baseDelay: 1000, // 1s, 2s, 4s, 8s, ...
  maxRetries: 3,
})
```

## Advanced Usage

### Custom Retry Condition
```typescript
retryPlugin({
  maxRetries: 3,
  shouldRetry: (error, attempt) => {
    const err = error as { status?: number; message?: string };
    
    // Retry on network errors or specific status codes
    if (!err.status) {
      return true; // Network error
    }
    
    // Retry on 5xx errors or 429 (Too Many Requests)
    if (err.status >= 500 || err.status === 429) {
      return true;
    }
    
    // Don't retry on client errors (4xx except 429)
    return false;
  },
})
```

### Retry Events Monitoring
```typescript
retryPlugin({
  maxRetries: 3,
  onRetry: (error, attempt, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms`);
    console.error('Error:', error);
  },
})
```

### Selective Retry by HTTP Method
```typescript
retryPlugin({
  maxRetries: 3,
  retryMethods: ['GET'], // Only retry GET requests
  retryStatusCodes: [500, 502, 503, 504, 429],
})
```

### Combining with Other Plugins
```typescript
import { createApiClient } from 'endpoint-fetcher';
import { retryPlugin } from '@endpoint-fetcher/retry';
import { cache } from '@endpoint-fetcher/cache';

const api = createApiClient({
  // ... endpoints
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    retryPlugin({
      maxRetries: 3,
      strategy: 'exponential',
    }),
    cache({
      ttl: 300000, // 5 minutes
    }),
  ],
});
```

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Watch mode for development
npm run watch
```

## License

MIT