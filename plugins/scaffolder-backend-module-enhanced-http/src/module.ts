import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createFrontendJsonHttpAction } from './actions/frontendJsonHttp';

export const scaffolderModuleFrontendJsonHttp = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'frontend-json-http',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: 'config',
      },
      async init({ scaffolder, config }) {
        scaffolder.addActions(createFrontendJsonHttpAction(config));
      },
    });
  },
});

export default scaffolderModuleFrontendJsonHttp;
