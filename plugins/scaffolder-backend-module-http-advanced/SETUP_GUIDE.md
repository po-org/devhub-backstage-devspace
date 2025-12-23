# Complete File Structure

Here's the complete structure for your scaffolder backend module:

```
plugins/scaffolder-backend-module-http-advanced/
├── package.json
├── README.md
├── config.d.ts
└── src/
    ├── index.ts
    ├── alpha.ts
    ├── module.ts
    └── actions/
        ├── index.ts
        └── http-advanced-action.ts
```

## Installation Steps

### 1. Copy Files

Copy all the files into your `plugins/scaffolder-backend-module-http-advanced/` directory:

**Root Level:**
- `package.json` → Root of the module
- `README.md` → Root of the module
- `config.d.ts` → Root of the module

**src/ Directory:**
- `src/index.ts`
- `src/alpha.ts`
- `src/module.ts`

**src/actions/ Directory:**
- `src/actions/index.ts`
- `src/actions/http-advanced-action.ts`

### 2. Install Dependencies

From your Backstage root directory:

```bash
# Install dependencies for the new module
yarn install

# Build the module
yarn workspace @internal/backstage-plugin-scaffolder-backend-module-http-advanced build
```

### 3. Register the Module

#### Option A: New Backend System (Recommended)

Edit `packages/backend/src/index.ts`:

```typescript
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins
backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));

// Add the enhanced HTTP module
backend.add(import('@internal/backstage-plugin-scaffolder-backend-module-http-advanced'));

backend.start();
```

#### Option B: Legacy Backend System

Edit `packages/backend/src/plugins/scaffolder.ts`:

```typescript
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter, createBuiltinActions } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';
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

  // Add custom action
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

### 4. Add to Backend Dependencies

Edit `packages/backend/package.json`:

```json
{
  "dependencies": {
    "@internal/backstage-plugin-scaffolder-backend-module-http-advanced": "^0.1.0",
    // ... other dependencies
  }
}
```

### 5. Update Workspace Configuration (if needed)

If you're using yarn workspaces, ensure `package.json` at root includes:

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

### 6. Restart Backend

```bash
yarn workspace backend start
```

You should see in the logs:
```
[backend] Registered action: http:backstage:request:advanced
```

## Verification

### Create Test Template

Create `templates/test-http-advanced.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: test-http-advanced
  title: Test HTTP Advanced Plugin
  description: Test the enhanced HTTP plugin
spec:
  owner: engineering
  type: service
  
  steps:
    - id: test-get
      name: Test GET Request
      action: http:backstage:request:advanced
      input:
        url: https://api.github.com/zen
        method: GET
        verbose: true
    
    - id: show-result
      name: Show Result
      action: debug:log
      input:
        message: |
          ✅ Request succeeded!
          Status: ${{ steps['test-get'].output.httpResponse.summary.status }}
          Duration: ${{ steps['test-get'].output.httpResponse.summary.durationMs }}ms
          Success: ${{ steps['test-get'].output.httpResponse.summary.success }}
          Data: ${{ steps['test-get'].output.httpResponse.data }}
```

### Run the Template

1. Go to Backstage UI
2. Navigate to Create/Templates
3. Find "Test HTTP Advanced Plugin"
4. Click "Choose"
5. Run it
6. Check the logs for verbose output

## Troubleshooting

### Module Not Found

```bash
# Re-install dependencies
yarn install

# Build the module
yarn workspace @internal/backstage-plugin-scaffolder-backend-module-http-advanced build

# Check workspace configuration
yarn workspaces list
```

### TypeScript Errors

```bash
# Build from the module directory
cd plugins/scaffolder-backend-module-http-advanced
yarn build

# Or from root
yarn workspace @internal/backstage-plugin-scaffolder-backend-module-http-advanced build
```

### Action Not Registered

1. Check backend logs for errors
2. Verify module is imported in backend index.ts
3. Ensure module ID is correct: `http-advanced`
4. Restart backend completely

### Import Errors

Make sure all dependencies are installed:
```bash
yarn install
```

Check that these packages exist:
- `@backstage/backend-plugin-api`
- `@backstage/plugin-scaffolder-node`
- `node-fetch`
- `zod`

## Optional: App Config

You can add default configuration in `app-config.yaml`:

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

## Next Steps

1. ✅ All files copied
2. ✅ Dependencies installed
3. ✅ Module registered
4. ✅ Backend restarted
5. ✅ Test template runs successfully
6. 📝 Update production templates
7. 📝 Enable retry on critical workflows
8. 📝 Add monitoring/metrics

## File Checklist

Make sure you have all these files:

```
plugins/scaffolder-backend-module-http-advanced/
├── ✅ package.json
├── ✅ README.md
├── ✅ config.d.ts
└── src/
    ├── ✅ index.ts
    ├── ✅ alpha.ts
    ├── ✅ module.ts
    └── actions/
        ├── ✅ index.ts
        └── ✅ http-advanced-action.ts
```

If all files are present, you're ready to go! 🚀
