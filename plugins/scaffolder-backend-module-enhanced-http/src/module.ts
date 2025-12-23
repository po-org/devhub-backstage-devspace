import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createEnhancedHttpAction } from './actions/enhancedHttp';

/**
 * Backend module to register the enhanced HTTP action
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
