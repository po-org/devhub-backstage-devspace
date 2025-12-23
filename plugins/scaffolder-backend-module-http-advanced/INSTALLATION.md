# Red Hat Developer Hub - Dynamic Plugin Installation

## Overview

This plugin is designed to be exported as a dynamic plugin for Red Hat Developer Hub using the new Backstage backend system.

## Structure

```
scaffolder-backend-module-http-advanced/
├── package.json                    # Includes @backstage/backend-plugin-api
├── README.md
├── config.d.ts
└── src/
    ├── index.ts                    # Exports BackendModule as default
    └── actions/
        ├── index.ts
        └── http-advanced-action.ts
```

## Prerequisites

- Red Hat Developer Hub installed
- Node.js 18+ and npm installed
- `@red-hat-developer-hub/cli` package

## Installation Steps

### Step 1: Copy Plugin to Your Workspace

```bash
# Extract to your Backstage workspace
cd your-backstage-workspace/plugins/
unzip scaffolder-backend-module-http-advanced.zip
```

### Step 2: Install Dependencies

```bash
cd ../..  # Back to workspace root
yarn install
```

### Step 3: Build the Plugin

```bash
cd plugins/scaffolder-backend-module-http-advanced
yarn build
```

### Step 4: Export as Dynamic Plugin

From the plugin directory:

```bash
npx @red-hat-developer-hub/cli@latest plugin export \
  --shared-package '!@backstage/*' \
  --embed-package node-fetch \
  --embed-package zod
```

This will create a `dist-dynamic` folder with the dynamic plugin package.

### Step 5: Package the Dynamic Plugin

The exported plugin in `dist-dynamic/` can be packaged as:

**Option A: OCI Image (Recommended)**
```bash
# Build container image
docker build -t my-registry/http-advanced-dynamic:0.1.0 -f Dockerfile.dynamic .
docker push my-registry/http-advanced-dynamic:0.1.0
```

**Option B: TGZ File**
```bash
cd dist-dynamic
npm pack
# This creates backstage-plugin-scaffolder-backend-module-http-advanced-dynamic-0.1.0.tgz
```

### Step 6: Configure in RHDH

Add to your `app-config.yaml`:

```yaml
dynamicPlugins:
  plugins:
    - package: '@internal/backstage-plugin-scaffolder-backend-module-http-advanced-dynamic'
      integrity: 'sha512-...'  # Generated during export
      # For OCI image:
      pluginConfig:
        registry: my-registry
        image: http-advanced-dynamic
        tag: 0.1.0
```

Or for TGZ:

```yaml
dynamicPlugins:
  plugins:
    - package: './dynamic-plugins/backstage-plugin-scaffolder-backend-module-http-advanced-dynamic-0.1.0.tgz'
      integrity: 'sha512-...'
```

## Usage in Templates

Once installed, use it in your scaffolder templates:

```yaml
steps:
  - id: fetch-data
    name: Fetch Data
    action: http:backstage:request:advanced
    input:
      url: https://api.example.com/data
      method: GET
      auth:
        type: bearer
        token: ${{ secrets.API_TOKEN }}
      retry:
        enabled: true
        maxRetries: 3
```

## Features

✅ **Auto Retry** - Exponential backoff for transient failures  
✅ **Pagination** - Offset, cursor, and page-based  
✅ **Auth** - Bearer, Basic, API Key, OAuth2  
✅ **Transform** - JSON path extraction  
✅ **Validation** - Conditional checks  
✅ **Metrics** - Performance tracking  
✅ **Clean Output** - Structured data  

## Troubleshooting

### TypeScript Compilation Errors

If you see errors during export about missing type declarations:

```bash
# Build the plugin first
yarn workspace @internal/backstage-plugin-scaffolder-backend-module-http-advanced build
```

### Missing @backstage/backend-plugin-api

Update your Backstage version or install the dependency:

```bash
yarn add @backstage/backend-plugin-api
```

### Dynamic Export Fails

Ensure:
1. Plugin is built: `yarn build`
2. Default export is present in `src/index.ts`
3. Using new backend system APIs

### Plugin Not Registered

Check RHDH logs:
```bash
kubectl logs <rhdh-pod> | grep "http-advanced"
```

You should see:
```
Registering HTTP advanced action
```

## Accessing Output in Templates

```yaml
# Response data
${{ steps.myStep.output.httpResponse.data }}

# Summary
${{ steps.myStep.output.httpResponse.summary.status }}
${{ steps.myStep.output.httpResponse.summary.durationMs }}
${{ steps.myStep.output.httpResponse.summary.success }}

# Metrics
${{ steps.myStep.output.httpResponse.metrics.retryCount }}
```

## Configuration Options

### Retry Configuration
```yaml
input:
  retry:
    enabled: true
    maxRetries: 5
    retryDelay: 2000
    exponentialBackoff: true
    retryOn: [500, 502, 503, 504, 429]
```

### Pagination Configuration
```yaml
input:
  pagination:
    enabled: true
    type: page  # or offset, cursor
    maxPages: 10
    resultsPath: data.items
```

### Response Transformation
```yaml
input:
  transformResponse:
    enabled: true
    jsonPath: data.user.email
```

## Version Compatibility

This plugin requires:
- Red Hat Developer Hub 1.2+
- Backstage backend system (new backend)
- Node.js 18+

## Support

For issues with:
- **Plugin functionality**: Check plugin README.md
- **Dynamic export**: See RHDH documentation
- **RHDH deployment**: Contact Red Hat support

## Notes

- The plugin uses the new Backstage backend system (`createBackendModule`)
- Default export is a `BackendModule` for dynamic loading
- Dependencies like `node-fetch` and `zod` are embedded in the dynamic package
- `@backstage/*` packages are shared (peer dependencies)

## Example: Complete Export Command

```bash
# From plugin directory
npx @red-hat-developer-hub/cli@latest plugin export \
  --shared-package '!@backstage/*' \
  --embed-package node-fetch \
  --embed-package zod \
  --embed-package @internal/backstage-plugin-scaffolder-backend-module-http-advanced
```

This ensures:
- All `@backstage` packages are shared (not bundled)
- `node-fetch` and `zod` are embedded (bundled)
- The plugin itself is embedded

## After Export

The `dist-dynamic/` folder contains:
- `package.json` - Modified for dynamic loading
- `dist/` - Compiled TypeScript
- `embedded/` - Bundled dependencies
- `node_modules/` - Private dependencies

Package this folder using your preferred method (OCI, TGZ, etc.) and deploy to RHDH!
