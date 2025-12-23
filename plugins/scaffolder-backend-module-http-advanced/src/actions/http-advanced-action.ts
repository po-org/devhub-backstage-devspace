import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fetch from 'node-fetch';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const DEFAULT_RETRIES = 3;
const RETRY_STATUSES = [429, 500, 502, 503];
const DEFAULT_TIMEOUT_MS = 30000;

const inputSchema = z.object({
  path: z.string().describe('The proxy path to call, e.g. /proxy/github/repos/org/repo'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  polling: z
    .object({
      enabled: z.boolean().default(false),
      intervalMs: z.number().default(5000),
      timeoutMs: z.number().default(60000),
    })
    .optional(),
});

type InputType = z.infer<typeof inputSchema>;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function requestWithRetries(
  url: string,
  options: any,
  maxRetries = DEFAULT_RETRIES
) {
  let attempt = 0;
  let lastError: Error | null = null;
  let totalRetryMs = 0;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (RETRY_STATUSES.includes(response.status) && attempt < maxRetries) {
        const delay = 500 * 2 ** attempt;
        totalRetryMs += delay;
        attempt++;
        await sleep(delay);
        continue;
      }

      return { response, retries: attempt, totalRetryMs };
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = 500 * 2 ** attempt;
        totalRetryMs += delay;
        attempt++;
        await sleep(delay);
      } else throw lastError;
    }
  }
  throw lastError || new Error('Request failed after all retries');
}

export function createHttpAdvancedAction() {
  return createTemplateAction<InputType>({
    id: 'http:advanced:request',
    description: 'HTTP request via Backstage proxy with retries, optional polling, and structured output',
    schema: { input: inputSchema, output: z.object({ prettyJson: z.string() }) },

    async handler(ctx) {
      const { input, output } = ctx;
      const startTime = Date.now();
      const requestId = uuid();

      const requestOptions: any = {
        method: input.method,
        headers: { 'Content-Type': 'application/json', ...input.headers },
        body: ['POST', 'PUT', 'PATCH'].includes(input.method) && input.body ? JSON.stringify(input.body) : undefined,
        timeout: DEFAULT_TIMEOUT_MS,
      };

      try {
        let responseData: any;
        let responseStatus: number;
        let retryCount = 0;
        let totalRetryMs = 0;

        if (input.polling?.enabled) {
          const endTime = Date.now() + (input.polling.timeoutMs ?? 60000);
          do {
            const { response, retries, totalRetryMs: retryMs } = await requestWithRetries(input.path, requestOptions);
            responseStatus = response.status;
            retryCount = retries;
            totalRetryMs = retryMs;
            responseData = await response.json();
            if (response.ok) break;
            await sleep(input.polling.intervalMs ?? 5000);
          } while (Date.now() < endTime);
        } else {
          const { response, retries, totalRetryMs: retryMs } = await requestWithRetries(input.path, requestOptions);
          responseStatus = response.status;
          retryCount = retries;
          totalRetryMs = retryMs;
          responseData = await response.json();
        }

        const durationMs = Date.now() - startTime;

        const structuredOutput = {
          summary: { success: responseStatus >= 200 && responseStatus < 300, status: responseStatus, retries: retryCount, durationMs },
          request: { id: requestId, method: input.method, path: input.path, timestamp: new Date(startTime).toISOString() },
          response: { status: responseStatus, timestamp: new Date().toISOString(), headers: requestOptions.headers },
          data: responseData,
          metrics: { retryCount, totalRetryMs },
        };

        output('prettyJson', JSON.stringify(structuredOutput, null, 2));
      } catch (error: any) {
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    },
  });
}
