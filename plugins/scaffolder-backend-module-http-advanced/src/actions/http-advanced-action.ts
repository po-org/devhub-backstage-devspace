import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fetch from 'node-fetch';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const DEFAULT_RETRIES = 3;
const RETRY_STATUSES = [429, 500, 502, 503];
const DEFAULT_TIMEOUT_MS = 30000;

// Minimal input schema for template authors
const inputSchema = z.object({
  url: z.string().describe('The URL to request'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  verbose: z.boolean().default(false),
  auth: z
    .object({
      type: z.enum(['bearer', 'basic', 'apiKey']).optional(),
      token: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      apiKeyHeader: z.string().optional(),
      apiKeyValue: z.string().optional(),
    })
    .optional(),
  polling: z
    .object({
      enabled: z.boolean().default(false),
      intervalMs: z.number().default(5000),
      timeoutMs: z.number().default(60000),
    })
    .optional(),
});

type InputType = z.infer<typeof inputSchema>;

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function buildHeaders(input: InputType): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...input.headers };
  if (!input.auth) return headers;

  switch (input.auth.type) {
    case 'bearer':
      if (input.auth.token) headers['Authorization'] = `Bearer ${input.auth.token}`;
      break;
    case 'basic':
      if (input.auth.username && input.auth.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${input.auth.username}:${input.auth.password}`).toString('base64')}`;
      }
      break;
    case 'apiKey':
      if (input.auth.apiKeyHeader && input.auth.apiKeyValue) {
        headers[input.auth.apiKeyHeader] = input.auth.apiKeyValue;
      }
      break;
  }
  return headers;
}

async function requestWithRetries(
  url: string,
  options: any,
  maxRetries = DEFAULT_RETRIES,
  verbose = false,
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
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = 500 * 2 ** attempt;
        totalRetryMs += delay;
        if (verbose) logger?.info(`Attempt ${attempt + 1} failed (${error.message}), retrying in ${delay}ms...`);
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
    description: 'Enterprise-ready HTTP request with retries, polling, and structured output',
    schema: { input: inputSchema, output: z.object({ prettyJson: z.string() }) },

    async handler(ctx) {
      const { input, logger, output } = ctx;
      const startTime = Date.now();
      const requestId = uuid();
      const verbose = input.verbose ?? false;

      const headers = buildHeaders(input);
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

        if (input.polling?.enabled) {
          const endTime = Date.now() + (input.polling.timeoutMs ?? 60000);
          do {
            const { response, retries, totalRetryMs: retryMs } = await requestWithRetries(
              input.url,
              requestOptions,
              DEFAULT_RETRIES,
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
            DEFAULT_RETRIES,
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
          summary: { success: responseStatus >= 200 && responseStatus < 300, status: responseStatus, retries: retryCount, durationMs },
          request: { id: requestId, method: input.method, url: input.url, timestamp: new Date(startTime).toISOString() },
          response: { status: responseStatus, timestamp: new Date().toISOString(), headers },
          data: responseData,
          metrics: { retryCount, totalRetryMs },
        };

        output('prettyJson', JSON.stringify(structuredOutput, null, 2));

        if (verbose) logger?.info(`Request completed in ${durationMs}ms, requestId=${requestId}`);
      } catch (error: any) {
        const durationMs = Date.now() - startTime;
        logger.error(`Request failed after ${durationMs}ms: ${error.message}, requestId=${requestId}`);
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    },
  });
}
