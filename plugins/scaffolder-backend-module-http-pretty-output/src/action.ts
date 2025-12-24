import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

export const createPrettyOutputAction = () =>
  createTemplateAction({
    id: 'http-pretty-output:log',
    description: 'Pretty-prints JSON data in scaffolder logs',
    schema: {
      input: z.object({
        data: z.any({
          description: 'The data to pretty-print (any JSON-serializable value)',
        }),
        maskKeys: z
          .array(z.string())
          .optional()
          .default([]),
      }),
    },

    async handler(ctx) {
      const { data, maskKeys = [] } = ctx.input;

      if (data === undefined || data === null) {
        ctx.logger.warn('No data provided to pretty-output action');
        return;
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

      try {
        const pretty = JSON.stringify(mask(data), null, 2);
        ctx.logger.info('--- Pretty JSON Output ---');
        ctx.logger.info(pretty);
        ctx.logger.info('--- End Pretty JSON Output ---');
      } catch (error) {
        ctx.logger.error(`Failed to stringify data: ${error}`);
        throw new Error(`Failed to pretty-print data: ${error}`);
      }
    },
  });
