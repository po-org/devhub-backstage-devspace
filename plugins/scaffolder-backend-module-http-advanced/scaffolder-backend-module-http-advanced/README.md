# @internal/backstage-plugin-scaffolder-backend-module-http-advanced

Enhanced HTTP request action for Backstage scaffolder with automatic retry, pagination, response transformation, and comprehensive observability.

## Installation

### New Backend System (Recommended)

```bash
# From your Backstage root directory
yarn --cwd packages/backend add @internal/backstage-plugin-scaffolder-backend-module-http-advanced
```

Then add to your backend in `packages/backend/src/index.ts`:

```typescript
// Add this import
import { scaffolderModuleHttpAdvanced } from '@internal/backstage-plugin-scaffolder-backend-module-http-advanced';

// Add to your backend
const backend = createBackend();
// ... other plugins
backend.add(scaffolderModuleHttpAdvanced());
backend.start();
```

### Legacy Backend System

```typescript
// packages/backend/src/plugins/scaffolder.ts
import { createRouter } from '@backstage/plugin-scaffolder-backend';
import { createHttpAdvancedAction } from '@internal/backstage-plugin-scaffolder-backend-module-http-advanced';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });

  const builtInActions = createBuiltinActions({
    integrations: env.integrations,
    catalogClient,
    reader: env.reader,
    config: env.config,
  });

  const customActions = [
    createHttpAdvancedAction(),
  ];

  return await createRouter({
    actions: [...builtInActions, ...customActions],
    logger: env.logger,
    config: env.config,
    database: env.database,
    reader: env.reader,
    catalogClient,
  });
}
```

## Features

✅ **Automatic Retry** - Exponential backoff for transient failures  
✅ **Pagination** - Offset, cursor, and page-based  
✅ **Multiple Auth** - Bearer, Basic, API Key, OAuth2  
✅ **Response Transform** - Extract nested values with JSON path  
✅ **Validation** - Conditional checks on status, body, headers  
✅ **Metrics** - Duration, retries, pagination stats  
✅ **Clean Output** - Structured data for frontend  
✅ **Verbose Mode** - Detailed logging for debugging  

## Usage

### Simple GET Request

```yaml
steps:
  - id: fetch-user
    name: Fetch GitHub User
    action: http:backstage:request:advanced
    input:
      url: https://api.github.com/users/octocat
      method: GET
      auth:
        type: bearer
        token: ${{ secrets.GITHUB_TOKEN }}
```

### With Retry

```yaml
steps:
  - id: fetch-data
    name: Fetch Data with Retry
    action: http:backstage:request:advanced
    input:
      url: https://api.example.com/data
      method: GET
      retry:
        enabled: true
        maxRetries: 5
        retryDelay: 2000
        exponentialBackoff: true
        retryOn: [500, 502, 503, 504, 429]
```

### With Pagination

```yaml
steps:
  - id: fetch-all-repos
    name: Fetch All Repositories
    action: http:backstage:request:advanced
    input:
      url: https://api.github.com/user/repos
      method: GET
      auth:
        type: bearer
        token: ${{ secrets.GITHUB_TOKEN }}
      pagination:
        enabled: true
        type: page
        maxPages: 10
```

### With Response Transformation

```yaml
steps:
  - id: create-issue
    name: Create JIRA Issue
    action: http:backstage:request:advanced
    input:
      url: https://jira.example.com/rest/api/2/issue
      method: POST
      auth:
        type: basic
        username: ${{ secrets.JIRA_USER }}
        password: ${{ secrets.JIRA_TOKEN }}
      body:
        fields:
          project: { key: PROJ }
          summary: ${{ parameters.summary }}
          issuetype: { name: Story }
      transformResponse:
        enabled: true
        jsonPath: key  # Extract just the issue key
      retry:
        enabled: true
        maxRetries: 3
```

### Health Check with Validation

```yaml
steps:
  - id: health-check
    name: Wait for Service
    action: http:backstage:request:advanced
    input:
      url: https://my-service.example.com/health
      method: GET
      conditionalRequest:
        ifStatusEquals: 200
        ifBodyContains: '"status":"healthy"'
      retry:
        enabled: true
        maxRetries: 20
        retryDelay: 5000
        exponentialBackoff: false
```

## Configuration

### Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | *required* | Target URL |
| `method` | enum | `GET` | HTTP method |
| `auth` | object | - | Authentication config |
| `retry` | object | - | Retry config |
| `timeout` | number | `30000` | Timeout in ms |
| `pagination` | object | - | Pagination config |
| `transformResponse` | object | - | Transform config |
| `conditionalRequest` | object | - | Validation rules |
| `verbose` | boolean | `false` | Enable detailed logs |

### Output Structure

```typescript
{
  summary: {
    success: boolean,
    status: number,
    statusText: string,
    method: string,
    url: string,
    durationMs: number,
    recordCount?: number,
    retries?: number
  },
  data: any,
  metrics: {
    totalDurationMs: number,
    retryCount: number,
    retryDelaysTotalMs: number,
    pagesProcessed?: number,
    totalRecords?: number
  },
  request: {
    method: string,
    url: string,
    timestamp: string
  },
  response: {
    status: number,
    statusText: string,
    timestamp: string,
    contentType?: string
  }
}
```

### Accessing Output

```yaml
# Response data
${{ steps.myStep.output.httpResponse.data }}

# Summary
${{ steps.myStep.output.httpResponse.summary.success }}
${{ steps.myStep.output.httpResponse.summary.status }}
${{ steps.myStep.output.httpResponse.summary.durationMs }}

# Metrics
${{ steps.myStep.output.httpResponse.metrics.retryCount }}
```

## App Config (Optional)

You can set default values in `app-config.yaml`:

```yaml
scaffolder:
  httpAdvanced:
    defaultTimeout: 30000
    defaultRetry:
      enabled: false
      maxRetries: 3
      retryDelay: 1000
      exponentialBackoff: true
    defaultPagination:
      maxPages: 10
    verboseLogging: false
```

## Comparison with Generic Plugin

| Feature | Generic | Enhanced |
|---------|---------|----------|
| Basic HTTP | ✅ | ✅ |
| Auto Retry | ❌ | ✅ |
| Pagination | ❌ | ✅ |
| Metrics | ❌ | ✅ |
| Transform | ❌ | ✅ |
| Validation | ❌ | ✅ |

## Troubleshooting

### Action Not Found

Make sure you've:
1. Added the module to your backend
2. Restarted the backend
3. Check logs for registration message

### TypeScript Errors

```bash
yarn workspace @internal/backstage-plugin-scaffolder-backend-module-http-advanced build
```

### Retry Not Working

- Check `retry.enabled: true`
- Verify `retryOn` status codes match API errors
- Enable `verbose: true` to see retry attempts

## Development

```bash
# Build
yarn build

# Test
yarn test

# Lint
yarn lint
```

## License

Apache-2.0

## Links

- [Full Documentation](https://your-docs-link)
- [Examples](https://your-examples-link)
- [Backstage Plugin Marketplace](https://backstage.io/plugins)
