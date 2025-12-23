import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

export function createJsonFormatAction() {
  return createTemplateAction({
    id: 'json:format',
    description: 'Format an object as pretty JSON for Scaffolder output',

    schema: {
      input: z.object({
        inputObject: z.any(),
        indent: z.number().default(2),
      }),
      output: z.object({
        prettyJson: z.string(),
      }),
    },

    async handler(ctx) {
      const { input, output } = ctx;

      const prettyJson = JSON.stringify(input.inputObject, null, input.indent);

      output('prettyJson', prettyJson);
    },
  });
}
