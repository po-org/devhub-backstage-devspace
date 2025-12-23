import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

/* =========================
   INPUT SCHEMA
   ========================= */

const inputSchema = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  responseType: z.enum(['json', 'text']).default('json'),
  verbose: z.boolean().default(false),
  auth: z
    .object({
      type: z.enum(['bearer']),
      token: z.string(),
    })
    .optional(),
  saveResponse: z
    .object({
      outputKey: z.string().default('httpResponse'),
    })
    .optional(),
});

/* =========================
   OUTPUT SCHEMA
   ========================= */

const outputSchema = z.object({
  summary: z.object({
    success: z.boolean(),
    status: z.number(),
    statusText: z.string(),
    method: z.string(),
    url: z.string(),
    durationMs: z.number(),
  }),
  data: z.any(),
  request: z.object({
    method: z.string(),
    url: z.string(),
    timestamp: z.string(),
  }),
  response: z.object({
    status: z.number(),
    statusText: z.string(),
    timestamp: z.string(),
    contentType: z.string().optional(),
  }),
});

type InputType = z.infer<typeof inputSchema>;

export function createHttpAdvancedAction({ fetch }: any) {
  return createTemplateAction<InputType>({
    id: 'http:backstage:request:advanced',
    description: 'Advanced HTTP request with real diagnostics',

    schema: {
      input: inputSchema,
      output: outputSchema,
    },

    async handler(ctx) {
      const { input, logger, output } = ctx;
      const start = Date.now();

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'backstage-scaffolder-http-advanced',
        ...input.headers,
      };

      if (input.auth?.type === 'bearer') {
        headers.Authorization = `Bearer ${input.auth.token}`;
      }

      const requestInit: RequestInit = {
        method: input.method,
        headers,
        body:
          input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)
            ? JSON.stringify(input.body)
            : undefined,
      };

      try {
        const response = await fetch.fetch(input.url, requestInit);
        const contentType = response.headers.get('content-type') ?? '';

        if (!response.ok) {
          const text = await response.text();
          logger.error(
            `HTTP ${response.status} ${response.statusText} from ${input.url}`,
          );
          if (input.verbose) {
            logger.error(text.slice(0, 2000));
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data: any;
        if (input.responseType === 'json') {
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            logger.error(`Expected JSON, received ${contentType}`);
            if (input.verbose) {
              logger.error(text.slice(0, 2000));
            }
            throw new Error('Non-JSON response');
          }
          data = await response.json();
        } else {
          data = await response.text();
        }

        const duration = Date.now() - start;

        output(
          input.saveResponse?.outputKey ?? 'httpResponse',
          {
            summary: {
              success: true,
              status: response.status,
              statusText: response.statusText,
              method: input.method,
              url: input.url,
              durationMs: duration,
            },
            data,
            request: {
              method: input.method,
              url: input.url,
              timestamp: new Date(start).toISOString(),
            },
            response: {
              status: response.status,
              statusText: response.statusText,
              timestamp: new Date().toISOString(),
              contentType,
            },
          },
        );

        logger.info(
          `✓ ${input.method} ${input.url} completed in ${duration}ms`,
        );
      } catch (e: any) {
        logger.error(`✗ HTTP request failed: ${e.message}`);
        throw new Error(`HTTP request failed: ${e.message}`);
      }
    },
  });
}
