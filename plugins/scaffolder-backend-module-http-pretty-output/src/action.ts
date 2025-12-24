import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

export const createPrettyOutputAction = () =>
  createTemplateAction({
    id: 'http-pretty-output:log',
    description:
      'Pretty-prints JSON output from a previous scaffolder step, similar to debug:log',
    schema: {
      input: z.object({
        stepName: z.string({
          description: 'The id of the step whose output should be formatted',
        }),
        outputKey: z
          .string()
          .optional()
          .default('response'),
        maskKeys: z
          .array(z.string())
          .optional()
          .default([]),
      }),
    },

    async handler(ctx) {
      const { stepName, outputKey, maskKeys = [] } = ctx.input;

      // Access steps via workspacePath context
      const step = (ctx as any).steps?.[stepName];
      if (!step) {
        throw new Error(`Step '${stepName}' not found`);
      }

      let data = step.output?.[outputKey];

      if (data === undefined) {
        throw new Error(
          `Output key '${outputKey}' not found on step '${stepName}'`,
        );
      }

      const mask = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(mask);
        }
        if (obj && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [
              k,
              maskKeys.includes(k) ? '***' : mask(v),
            ]),
          );
        }
        return obj;
      };

      const pretty = JSON.stringify(mask(data), null, 2);

      // This is the magic: same visual behavior as debug:log
      ctx.logger.info(pretty);
    },
  });