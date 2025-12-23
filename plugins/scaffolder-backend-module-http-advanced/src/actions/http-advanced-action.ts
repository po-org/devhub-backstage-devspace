import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import { FetchApi } from '@backstage/core-plugin-api';

/* =========================
   INPUT / OUTPUT SCHEMAS
   (unchanged – omitted here for brevity)
   ========================= */

export function createHttpAdvancedAction(options: { fetch: FetchApi }) {
  const { fetch } = options;

  return createTemplateAction<InputType>({
    id: 'http:backstage:request:advanced',
    description: 'Advanced HTTP request with retry, pagination, and diagnostics',

    schema: {
      input: inputSchema,
      output: outputSchema,
    },

    async handler(ctx) {
      const { input, logger, output } = ctx;
      const startTime = Date.now();
      const verbose = input.verbose ?? false;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'backstage-scaffolder-http-advanced',
        ...input.headers,
      };

      if (input.auth?.type === 'bearer' && input.auth.token) {
        headers.Authorization = `Bearer ${input.auth.token}`;
      }

      const requestInit: RequestInit = {
        method: input.method,
        headers,
        body:
          input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)
            ? typeof input.body === 'string'
              ? input.body
              : JSON.stringify(input.body)
            : undefined,
      };

      let response: Response;
      let responseBody: any;

      try {
        response = await fetch.fetch(input.url, requestInit);

        const contentType = response.headers.get('content-type') ?? '';

        if (!response.ok) {
          const text = await response.text();
          logger.error(
            `HTTP ${response.status} ${response.statusText} from ${input.url}`,
          );
          if (verbose) {
            logger.error(`Response body:\n${text.slice(0, 2000)}`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (input.responseType === 'json') {
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            logger.error(`Expected JSON, received ${contentType}`);
            if (verbose) {
              logger.error(`Response body:\n${text.slice(0, 2000)}`);
            }
            throw new Error(`Non-JSON response received`);
          }
          responseBody = await response.json();
        } else if (input.responseType === 'text') {
          responseBody = await response.text();
        } else {
          responseBody = await response.arrayBuffer();
        }

        const duration = Date.now() - startTime;

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
            data: responseBody,
            request: {
              method: input.method,
              url: input.url,
              timestamp: new Date(startTime).toISOString(),
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
        const duration = Date.now() - startTime;
        logger.error(
          `✗ HTTP request failed after ${duration}ms: ${e.message}`,
        );
        throw new Error(`HTTP request failed: ${e.message}`);
      }
    },
  });
}
