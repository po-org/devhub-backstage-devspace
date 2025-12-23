import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createPrettyOutputAction } from './action';

export const httpPrettyOutputModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'http-pretty-output',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createPrettyOutputAction());
      },
    });
  },
});

export default httpPrettyOutputModule;
