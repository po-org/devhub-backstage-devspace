import { createPlugin } from '@backstage/core-plugin-api';
import {
  scaffolderTaskStepExtensionPoint,
  ScaffolderStepExtension,
} from '@backstage/plugin-scaffolder-react/alpha';
import React from 'react';
import { FrontendJsonStep } from './components/FrontendJsonStep';

export const scaffolderFrontendJsonPlugin = createPlugin({
  id: 'scaffolder-frontend-json',
  register({ register }) {
    register(
      scaffolderTaskStepExtensionPoint,
      new ScaffolderStepExtension({
        actionId: 'http:backstage:frontend-json',
        component: ({ step }) => {
          const output = step.output?.response;
          if (!output) {
            return null;
          }
          return <FrontendJsonStep output={output} />;
        },
      }),
    );
  },
});
