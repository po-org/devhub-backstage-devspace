/**
 * Enhanced HTTP Request Plugin for Backstage
 * 
 * File: http-advanced-action.ts
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Multiple authentication methods
 * - Pagination support (offset, cursor, page)
 * - Response transformation with JSON path
 * - Conditional validation
 * - Clean structured output
 * - Performance metrics
 * - Optional verbose logging
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

const inputSchema = z.object({
  url: z.string().describe('The URL to make the request to'),
  
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .default('GET')
    .describe('HTTP method'),
  
  headers: z.record(z.string())
    .optional()
    .describe('Custom request headers'),
  
  body: z.any()
    .optional()
    .describe('Request body (will be JSON stringified if object)'),
  
  auth: z.object({
    type: z.enum(['bearer', 'basic', 'apiKey', 'oauth2']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKeyHeader: z.string().optional(),
    apiKeyValue: z.string().optional(),
  }).optional()
    .describe('Authentication configuration'),
  
  retry: z.object({
    enabled: z.boolean().default(false),
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    retryOn: z.array(z.number()).default([408, 429, 500, 502, 503, 504]),
    exponentialBackoff: z.boolean().default(true),
  }).optional()
    .describe('Retry configuration'),
  
  timeout: z.number()
    .default(30000)
    .describe('Request timeout in milliseconds'),
  
  responseType: z.enum(['json', 'text', 'buffer', 'stream'])
    .default('json')
    .describe('Expected response type'),
  
  transformResponse: z.object({
    enabled: z.boolean().default(false),
    jsonPath: z.string().optional(),
  }).optional()
    .describe('Response transformation using JSON path'),
  
  pagination: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['offset', 'cursor', 'page']),
    limitParam: z.string().default('limit'),
    offsetParam: z.string().default('offset'),
    pageParam: z.string().default('page'),
    cursorParam: z.string().default('cursor'),
    maxPages: z.number().default(10),
    resultsPath: z.string().optional(),
    nextCursorPath: z.string().optional(),
  }).optional()
    .describe('Pagination configuration'),
  
  conditionalRequest: z.object({
    ifStatusEquals: z.number().optional(),
    ifBodyContains: z.string().optional(),
    ifHeaderExists: z.string().optional(),
  }).optional()
    .describe('Conditional validation rules'),
  
  saveResponse: z.object({
    enabled: z.boolean().default(true),
    outputKey: z.string().default('httpResponse'),
  }).optional()
    .describe('Output configuration'),
  
  verbose: z.boolean()
    .default(false)
    .describe('Enable detailed logging'),
});

type InputType = z.infer<typeof inputSchema>;

// ============================================================================
// OUTPUT SCHEMA
// ============================================================================

const outputSchema = z.object({
  summary: z.object({
    success: z.boolean(),
    status: z.number(),
    statusText: z.string(),
    method: z.string(),
    url: z.string(),
    durationMs: z.number(),
    recordCount: z.number().optional(),
    retries: z.number().optional(),
  }).describe('High-level summary'),
  
  data: z.any().describe('The response data'),
  
  metrics: z.object({
    totalDurationMs: z.number(),
    retryCount: z.number(),
    retryDelaysTotalMs: z.number(),
    pagesProcessed: z.number().optional(),
    totalRecords: z.number().optional(),
  }).optional(),
  
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build request headers with authentication
 */
function buildHeaders(input: InputType): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...input.headers,
  };

  if (input.auth) {
    switch (input.auth.type) {
      case 'bearer':
        if (input.auth.token) {
          headers['Authorization'] = `Bearer ${input.auth.token}`;
        }
        break;
      
      case 'basic':
        if (input.auth.username && input.auth.password) {
          const credentials = Buffer.from(
            `${input.auth.username}:${input.auth.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      
      case 'apiKey':
        if (input.auth.apiKeyHeader && input.auth.apiKeyValue) {
          headers[input.auth.apiKeyHeader] = input.auth.apiKeyValue;
        }
        break;
      
      case 'oauth2':
        if (input.auth.token) {
          headers['Authorization'] = `Bearer ${input.auth.token}`;
        }
        break;
    }
  }

  return headers;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with optional exponential backoff
 */
function getRetryDelay(
  attempt: number,
  baseDelay: number,
  exponential: boolean
): number {
  if (exponential) {
    return baseDelay * Math.pow(2, attempt - 1);
  }
  return baseDelay;
}

/**
 * Extract nested value from object using dot notation path
 */
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Make HTTP request with automatic retry logic
 */
async function makeRequestWithRetry(
  url: string,
  options: any,
  retryConfig?: InputType['retry'],
  verbose: boolean = false,
  logger?: any
): Promise<{ response: any; retryCount: number; retryDelayMs: number }> {
  const maxRetries = retryConfig?.enabled ? retryConfig.maxRetries : 0;
  let retryCount = 0;
  let totalRetryDelay = 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || 30000
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if we should retry based on status code
      if (
        retryConfig?.enabled &&
        attempt < maxRetries &&
        retryConfig.retryOn?.includes(response.status)
      ) {
        const delay = getRetryDelay(
          attempt + 1,
          retryConfig.retryDelay || 1000,
          retryConfig.exponentialBackoff ?? true
        );

        if (verbose) {
          logger?.info(
            `Attempt ${attempt + 1}/${maxRetries + 1} failed (${response.status}), ` +
            `retrying in ${formatDuration(delay)}...`
          );
        }

        retryCount++;
        totalRetryDelay += delay;
        await sleep(delay);
        continue;
      }

      // Success or non-retryable status
      return {
        response,
        retryCount,
        retryDelayMs: totalRetryDelay,
      };

    } catch (error: any) {
      lastError = error;

      if (attempt < maxRetries && retryConfig?.enabled) {
        const delay = getRetryDelay(
          attempt + 1,
          retryConfig.retryDelay || 1000,
          retryConfig.exponentialBackoff ?? true
        );

        if (verbose) {
          logger?.info(
            `Attempt ${attempt + 1}/${maxRetries + 1} failed (${error.message}), ` +
            `retrying in ${formatDuration(delay)}...`
          );
        }

        retryCount++;
        totalRetryDelay += delay;
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Handle paginated requests
 */
async function handlePagination(
  baseUrl: string,
  options: any,
  paginationConfig: NonNullable<InputType['pagination']>,
  retryConfig?: InputType['retry'],
  verbose: boolean = false,
  logger?: any
): Promise<{ results: any[]; pagesProcessed: number }> {
  const results: any[] = [];
  let page = 1;
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore && page <= paginationConfig.maxPages) {
    let paginatedUrl = baseUrl;
    const urlObj = new URL(baseUrl);

    // Add pagination parameters based on type
    switch (paginationConfig.type) {
      case 'offset':
        const offset = (page - 1) * 50;
        urlObj.searchParams.set(paginationConfig.offsetParam, offset.toString());
        urlObj.searchParams.set(paginationConfig.limitParam, '50');
        break;
      
      case 'page':
        urlObj.searchParams.set(paginationConfig.pageParam, page.toString());
        break;
      
      case 'cursor':
        if (cursor) {
          urlObj.searchParams.set(paginationConfig.cursorParam, cursor);
        }
        break;
    }

    paginatedUrl = urlObj.toString();

    if (verbose) {
      logger?.info(`Fetching page ${page}/${paginationConfig.maxPages}...`);
    }

    // Fetch page with retry support
    const { response } = await makeRequestWithRetry(
      paginatedUrl,
      options,
      retryConfig,
      verbose,
      logger
    );

    const data = await response.json();

    // Extract results from response
    const pageResults = paginationConfig.resultsPath
      ? getValueByPath(data, paginationConfig.resultsPath)
      : data;

    if (Array.isArray(pageResults)) {
      results.push(...pageResults);
      if (verbose) {
        logger?.info(
          `Page ${page}: Retrieved ${pageResults.length} items ` +
          `(total: ${results.length})`
        );
      }
    } else {
      results.push(pageResults);
    }

    // Check for next page
    if (paginationConfig.type === 'cursor' && paginationConfig.nextCursorPath) {
      cursor = getValueByPath(data, paginationConfig.nextCursorPath);
      hasMore = !!cursor;
    } else {
      hasMore = Array.isArray(pageResults) && pageResults.length > 0;
    }

    page++;
  }

  return {
    results,
    pagesProcessed: page - 1,
  };
}

// ============================================================================
// MAIN ACTION
// ============================================================================

export function createHttpAdvancedAction() {
  return createTemplateAction<InputType>({
    id: 'http:backstage:request:advanced',
    description: 'Advanced HTTP request with retry, pagination, and enhanced features',
    
    schema: {
      input: inputSchema,
      output: outputSchema,
    },

    async handler(ctx) {
      const { input, logger, output } = ctx;
      const startTime = Date.now();
      const verbose = input.verbose || false;

      try {
        // Log start if verbose
        if (verbose) {
          logger.info(`Starting ${input.method} request to ${input.url}`);
          if (input.retry?.enabled) {
            logger.info(
              `Retry enabled: max ${input.retry.maxRetries} attempts, ` +
              `${formatDuration(input.retry.retryDelay)} base delay`
            );
          }
          if (input.pagination?.enabled) {
            logger.info(
              `Pagination enabled: ${input.pagination.type}, ` +
              `max ${input.pagination.maxPages} pages`
            );
          }
        }

        // Build request options
        const headers = buildHeaders(input);
        const requestOptions: any = {
          method: input.method,
          headers,
          timeout: input.timeout,
        };

        // Add body for POST/PUT/PATCH
        if (input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)) {
          requestOptions.body =
            typeof input.body === 'string'
              ? input.body
              : JSON.stringify(input.body);
        }

        let responseData: any;
        let response: any;
        let retryCount = 0;
        let retryDelayMs = 0;
        let pagesProcessed: number | undefined;
        let totalRecords: number | undefined;

        // Handle pagination or single request
        if (input.pagination?.enabled) {
          if (verbose) {
            logger.info('Starting pagination...');
          }

          const result = await handlePagination(
            input.url,
            requestOptions,
            input.pagination,
            input.retry,
            verbose,
            logger
          );

          responseData = result.results;
          pagesProcessed = result.pagesProcessed;
          totalRecords = result.results.length;

          // Mock response for pagination
          response = {
            status: 200,
            statusText: 'OK',
            ok: true,
            headers: new Map(),
          };

        } else {
          // Single request with retry
          const result = await makeRequestWithRetry(
            input.url,
            requestOptions,
            input.retry,
            verbose,
            logger
          );

          response = result.response;
          retryCount = result.retryCount;
          retryDelayMs = result.retryDelayMs;

          // Parse response based on type
          switch (input.responseType) {
            case 'json':
              responseData = await response.json();
              break;
            case 'text':
              responseData = await response.text();
              break;
            case 'buffer':
              responseData = await response.buffer();
              break;
            case 'stream':
              responseData = response.body;
              break;
            default:
              responseData = await response.json();
          }
        }

        // Transform response if configured
        if (input.transformResponse?.enabled && input.transformResponse.jsonPath) {
          const originalData = responseData;
          responseData = getValueByPath(responseData, input.transformResponse.jsonPath);
          
          if (verbose) {
            logger.info(`Transformed response using path: ${input.transformResponse.jsonPath}`);
          }
        }

        // Conditional validation
        if (input.conditionalRequest) {
          if (
            input.conditionalRequest.ifStatusEquals &&
            response.status !== input.conditionalRequest.ifStatusEquals
          ) {
            throw new Error(
              `Expected status ${input.conditionalRequest.ifStatusEquals}, ` +
              `got ${response.status}`
            );
          }

          if (
            input.conditionalRequest.ifBodyContains &&
            !JSON.stringify(responseData).includes(input.conditionalRequest.ifBodyContains)
          ) {
            throw new Error(
              `Response body does not contain "${input.conditionalRequest.ifBodyContains}"`
            );
          }

          if (
            input.conditionalRequest.ifHeaderExists &&
            !response.headers?.has(input.conditionalRequest.ifHeaderExists)
          ) {
            throw new Error(
              `Response missing required header "${input.conditionalRequest.ifHeaderExists}"`
            );
          }

          if (verbose) {
            logger.info('All conditional validations passed');
          }
        }

        const totalDuration = Date.now() - startTime;

        // Calculate record count
        let recordCount: number | undefined;
        if (Array.isArray(responseData)) {
          recordCount = responseData.length;
        } else if (totalRecords !== undefined) {
          recordCount = totalRecords;
        }

        // Build structured output
        const structuredOutput = {
          summary: {
            success: true,
            status: response.status,
            statusText: response.statusText || 'OK',
            method: input.method,
            url: input.url,
            durationMs: totalDuration,
            ...(recordCount !== undefined && { recordCount }),
            ...(retryCount > 0 && { retries: retryCount }),
          },

          data: responseData,

          metrics: {
            totalDurationMs: totalDuration,
            retryCount,
            retryDelaysTotalMs: retryDelayMs,
            ...(pagesProcessed !== undefined && { pagesProcessed }),
            ...(totalRecords !== undefined && { totalRecords }),
          },

          request: {
            method: input.method,
            url: input.url,
            timestamp: new Date(startTime).toISOString(),
          },

          response: {
            status: response.status,
            statusText: response.statusText || 'OK',
            timestamp: new Date().toISOString(),
            contentType: response.headers?.get('content-type') || undefined,
          },
        };

        // Save to workflow context
        const outputKey = input.saveResponse?.outputKey || 'httpResponse';
        output(outputKey, structuredOutput);

        // Log completion
        if (verbose) {
          logger.info(`Request completed successfully in ${formatDuration(totalDuration)}`);
          if (retryCount > 0) {
            logger.info(`Succeeded after ${retryCount} retries`);
          }
          if (pagesProcessed) {
            logger.info(`Processed ${pagesProcessed} pages, ${totalRecords} total records`);
          }
        } else {
          logger.info(`✓ Request completed successfully in ${formatDuration(totalDuration)}`);
        }

      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error(`✗ Request failed after ${formatDuration(duration)}: ${error.message}`);
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    },
  });
}
