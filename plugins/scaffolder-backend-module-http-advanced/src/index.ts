import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createHttpAdvancedAction } from './actions/http-advanced-action';

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'http-advanced',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        fetch: coreServices.fetch,
        logger: coreServices.logger,
      },
      async init({ scaffolder, fetch, logger }) {
        logger.info('Registering HTTP advanced scaffolder action');
        scaffolder.addActions(
          createHttpAdvancedAction({ fetch }),
        );
      },
    });
  },
});
