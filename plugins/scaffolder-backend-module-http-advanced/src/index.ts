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
        logger: coreServices.logger,
        fetch: coreServices.fetch,
      },
      async init({ scaffolder, logger, fetch }) {
        logger.info('Registering HTTP advanced action');
        scaffolder.addActions(
          createHttpAdvancedAction({ fetch }),
        );
      },
    });
  },
});
