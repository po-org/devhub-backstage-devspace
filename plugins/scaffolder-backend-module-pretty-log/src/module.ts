import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createBackendModule } from '@backstage/backend-plugin-api';
import { createPrettyLogAction } from './actions/prettyLog';

/**
 * Scaffolder module for the pretty log action
 * 
 * @public
 */
export const scaffolderModulePrettyLog = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'pretty-log',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createPrettyLogAction());
      },
    });
  },
});

/**
 * @public
 */
export default scaffolderModulePrettyLog;