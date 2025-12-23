/**
 * Backend module for enhanced HTTP request actions
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createHttpAdvancedAction } from './actions/http-advanced-action';

/**
 * Scaffolder module for enhanced HTTP requests with retry, pagination, and advanced features
 * 
 * @public
 */
export const scaffolderModuleHttpAdvanced = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'http-advanced',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        // Register the enhanced HTTP action
        scaffolder.addActions(
          createHttpAdvancedAction(),
        );
      },
    });
  },
});
