import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import fetch from 'node-fetch';

/**
 * Enhanced HTTP request action
 */
export function createEnhancedHttpAction() {
  return createTemplateAction({
    id: 'http:backstage:enhanced',
    description: 'Perform HTTP requests with enhanced logging',
    schema: {
      input: z.object({
        url: z.string().describe('The URL to call'),
        method: z.string().default('GET').describe('HTTP method'),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
      }),
      output: z.any().optional(),
    },
    async handler(ctx) {
      const { url, method, headers, body } = ctx.input;
      ctx.logger.info(`➡️  Performing HTTP request: ${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseBody = await response.json().catch(() => null);

      ctx.logger.info(`⬅️  Response status: ${response.status}`);
      ctx.logger.info(`⬅️  Response body: ${JSON.stringify(responseBody, null, 2)}`);

      ctx.output('response', responseBody);
    },
  });
}
