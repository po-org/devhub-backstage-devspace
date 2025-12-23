import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import fetch from 'node-fetch';
import { Config } from '@backstage/config';

/**
 * http:backstage:frontend-json
 *
 * Same contract as http:backstage:request, but emits structured output
 * intended for frontend rendering (pretty JSON, tabs, polling, etc).
 */
export function createFrontendJsonHttpAction(config: Config) {
  return createTemplateAction({
    id: 'http:backstage:frontend-json',
    description: 'HTTP request via Backstage proxy with rich frontend output',
    schema: {
      input: z.object({
        method: z.string().default('GET'),
        path: z.string().describe('Proxy path, same as http:backstage:request'),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
      }),
      output: {
        type: 'object',
      },
    },

    async handler(ctx) {
      const { method, path, headers, body } = ctx.input;

      const baseUrl = config.getString('backend.baseUrl');
      const url = `${baseUrl}${path}`;

      const start = Date.now();

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const durationMs = Date.now() - start;

      let responseBody: any = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }

      ctx.output('response', {
        request: {
          method,
          path,
          headers,
          body,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        },
        meta: {
          durationMs,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });
}
