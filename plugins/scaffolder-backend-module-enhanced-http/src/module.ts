import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createBackendModule } from '@backstage/backend-plugin-api';
import { createEnhancedHttpAction } from '../actions/enhancedHttp';

/**
 * Backend module for enhanced HTTP scaffolder action
 */
export const scaffolderModuleEnhancedHttp = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'enhanced-http',
  register(env) {
    env.registerInit({
      deps: { scaffolder: scaffolderActionsExtensionPoint },
      async init({ scaffolder }) {
        scaffolder.addActions(createEnhancedHttpAction());
      },
    });
  },
});

export default scaffolderModuleEnhancedHttp;
