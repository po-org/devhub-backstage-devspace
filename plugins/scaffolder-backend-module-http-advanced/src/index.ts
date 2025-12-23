/**
 * Enhanced HTTP Request Action Plugin
 * 
 * @packageDocumentation
 */

import { 
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createHttpAdvancedAction } from './actions/http-advanced-action';

/**
 * Scaffolder backend module for HTTP advanced action
 * @public
 */
export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'http-advanced',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        logger: coreServices.logger,
      },
      async init({ scaffolder, logger }) {
        logger.info('Registering HTTP advanced action');
        scaffolder.addActions(createHttpAdvancedAction());
      },
    });
  },
});

// Also export the action for direct use if needed
export { createHttpAdvancedAction } from './actions/http-advanced-action';
