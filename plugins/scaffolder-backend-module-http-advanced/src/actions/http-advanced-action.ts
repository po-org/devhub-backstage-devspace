import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fetch, { HeadersInit } from 'node-fetch';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const DEFAULT_RETRIES = 3;
const RETRY_STATUSES = [429, 500, 502, 503];
const DEFAULT_TIMEOUT_MS = 30000;

// Input schema for template authors
const inputSchema = z.object({
  url: z.string().describe('The full URL or /proxy/... path to request'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  verbose: z.boolean().default(false),
  polling: z
    .object({
      enabled: z.boolean().default(false),
      intervalMs: z.number().default(5000),
      timeoutMs: z.number().default(60000),
    })
    .optional(),
  retry: z
    .object({
      enabled: z.boolean().default(true),
      maxRetries: z.number().default(DEFAULT_RETRIES),
    })
    .optional(),
});

type InputType = z.infer<typeof inputSchema>;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function requestWithRetries(
  url: string,
  options: any,
  maxRetries: number,
  verbose: boolean,
  logger?: any
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
        if (verbose) logger?.info(`Attempt ${attempt + 1} failed with status ${response.status}, retrying in ${delay}ms...`);
        attempt++;
        await sleep(delay);
        continue;
      }

      return { response, retries: attempt, totalRetryMs };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = 500 * 2 ** attempt;
        totalRetryMs += delay;
        if (verbose) logger?.info(`Attempt ${attempt + 1} failed (${err.message}), retrying in ${delay}ms...`);
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
    description: 'Enterprise-ready HTTP request via /proxy with retries, polling, and structured JSON output',
    schema: { input: inputSchema, output: z.object({ prettyJson: z.string() }) },

    async handler(ctx) {
      const { input, logger, output } = ctx;
      const startTime = Date.now();
      const requestId = uuid();
      const verbose = input.verbose ?? false;

      const headers: HeadersInit = { 'Content-Type': 'application/json', ...input.headers };

      // If the URL starts with /proxy/, Backstage injects the user token automatically
      if (input.url.startsWith('/proxy/') && verbose) {
        logger?.info(`Using /proxy request, token will be injected automatically`);
      }

      const requestOptions: any = {
        method: input.method,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(input.method) && input.body ? JSON.stringify(input.body) : undefined,
        timeout: DEFAULT_TIMEOUT_MS,
      };

      try {
        let responseData: any;
        let responseStatus: number;
        let retryCount = 0;
        let totalRetryMs = 0;

        const maxRetries = input.retry?.enabled ? input.retry.maxRetries : 0;

        if (input.polling?.enabled) {
          const endTime = Date.now() + (input.polling.timeoutMs ?? 60000);
          do {
            const { response, retries, totalRetryMs: retryMs } = await requestWithRetries(
              input.url,
              requestOptions,
              maxRetries,
              verbose,
              logger
            );
            responseStatus = response.status;
            retryCount = retries;
            totalRetryMs = retryMs;
            responseData = await response.json();
            if (response.ok) break;
            if (verbose) logger?.info(`Polling: status ${response.status}, retrying...`);
            await sleep(input.polling.intervalMs ?? 5000);
          } while (Date.now() < endTime);
        } else {
          const { response, retries, totalRetryMs: retryMs } = await requestWithRetries(
            input.url,
            requestOptions,
            maxRetries,
            verbose,
            logger
          );
          responseStatus = response.status;
          retryCount = retries;
          totalRetryMs = retryMs;
          responseData = await response.json();
        }

        const durationMs = Date.now() - startTime;

        const structuredOutput = {
          summary: {
            success: responseStatus >= 200 && responseStatus < 300,
            status: responseStatus,
            retries: retryCount,
            durationMs,
          },
          request: {
            id: requestId,
            method: input.method,
            url: input.url,
            timestamp: new Date(startTime).toISOString(),
          },
          response: {
            status: responseStatus,
            timestamp: new Date().toISOString(),
            headers,
          },
          data: responseData,
          metrics: { retryCount, totalRetryMs },
        };

        output('prettyJson', JSON.stringify(structuredOutput, null, 2));

        if (verbose) logger?.info(`Request completed in ${durationMs}ms, requestId=${requestId}`);
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        logger?.error(`Request failed after ${durationMs}ms: ${err.message}, requestId=${requestId}`);
        throw new Error(`HTTP request failed: ${err.message}`);
      }
    },
  });
}
