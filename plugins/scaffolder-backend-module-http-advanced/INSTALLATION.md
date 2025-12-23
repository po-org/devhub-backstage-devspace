# Installation Guide - Fixed Version

## Quick Fix for Dependency Issues

The original package.json had dependencies that might not match your Backstage version. This updated version removes those problematic dependencies.

## Installation Steps

### Step 1: Copy Files

Copy these files to `plugins/scaffolder-backend-module-http-advanced/`:

```
plugins/scaffolder-backend-module-http-advanced/
├── package.json          (use the FIXED version)
├── README.md
├── config.d.ts
└── src/
    ├── index.ts          (use the FIXED version)
    ├── module.ts         (use the FIXED version)
    └── actions/
        ├── index.ts
        └── http-advanced-action.ts
```

### Step 2: Install Dependencies

```bash
cd your-backstage-root
yarn install
```

This should work now! The fixed `package.json` only includes:
- `@backstage/plugin-scaffolder-node` (required)
- `node-fetch` (required)
- `zod` (required)

### Step 3: Register the Action

You need to manually register the action in your scaffolder plugin.

Edit `packages/backend/src/plugins/scaffolder.ts`:

```typescript
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter, createBuiltinActions } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';

// Import the enhanced HTTP action
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

  // Add the custom HTTP advanced action
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

### Step 4: Add to Backend Dependencies

Edit `packages/backend/package.json`:

```json
{
  "dependencies": {
    "@internal/backstage-plugin-scaffolder-backend-module-http-advanced": "^0.1.0",
    // ... other dependencies
  }
}
```

### Step 5: Install Again

```bash
yarn install
```

### Step 6: Start Backend

```bash
yarn workspace backend start
```

You should see:
```
[backend] Registered action: http:backstage:request:advanced
```

## Alternative: Direct Installation (No Plugin Package)

If you still have dependency issues, you can install the action directly:

### 1. Copy files directly to backend

```bash
mkdir -p packages/backend/src/plugins/scaffolder/actions
```

Copy these files:
- `src/actions/http-advanced-action.ts` → `packages/backend/src/plugins/scaffolder/actions/`
- `src/actions/index.ts` → `packages/backend/src/plugins/scaffolder/actions/`

### 2. Install dependencies in backend

Edit `packages/backend/package.json`:

```json
{
  "dependencies": {
    "node-fetch": "^2.7.0",
    "zod": "^3.22.4",
    // ... other dependencies
  }
}
```

```bash
yarn install
```

### 3. Register action

Edit `packages/backend/src/plugins/scaffolder.ts`:

```typescript
// Import from local actions directory
import { createHttpAdvancedAction } from './scaffolder/actions';

const customActions = [
  createHttpAdvancedAction(),
];
```

### 4. Start backend

```bash
yarn workspace backend start
```

## Troubleshooting

### Still getting dependency errors?

Check your Backstage version:

```bash
yarn list @backstage/plugin-scaffolder-node
```

Update the `package.json` to match your version:

```json
{
  "dependencies": {
    "@backstage/plugin-scaffolder-node": "^0.X.0"  // Match your version
  }
}
```

### TypeScript errors?

Make sure you have these in your backend's `package.json`:

```json
{
  "dependencies": {
    "@types/node": "^18.0.0",
    "@types/node-fetch": "^2.6.9"
  }
}
```

### Module not found?

Ensure your root `package.json` has the workspace configured:

```json
{
  "workspaces": {
    "packages": [
      "packages/*",
      "plugins/*"
    ]
  }
}
```

Then run:
```bash
yarn install
```

## Test It Works

Create a test template:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: test-http-advanced
  title: Test HTTP Advanced
spec:
  owner: engineering
  type: service
  steps:
    - id: test
      name: Test Request
      action: http:backstage:request:advanced
      input:
        url: https://api.github.com/zen
        method: GET
        verbose: true
```

Run it and check the logs!

## Summary

The main issue was the `@backstage/backend-plugin-api` dependency which might not exist in your Backstage version. The fixed version:

1. ✅ Removes problematic dependencies
2. ✅ Uses only standard Backstage dependencies
3. ✅ Works with both new and legacy backend systems
4. ✅ Simpler installation process

If you continue to have issues, use the "Direct Installation" method which bypasses the plugin package entirely.
