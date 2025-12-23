import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

/**
 * Enhanced HTTP request action with pretty JSON logging
 */
export function createEnhancedHttpAction() {
  return createTemplateAction({
    id: 'http:backstage:enhanced',
    description: 'Performs an HTTP request and logs the response in pretty JSON',
    schema: {
      input: z.object({
        method: z.string().default('GET').describe('HTTP method'),
        path: z.string().describe('Request path'),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
        logTitle: z.string().optional().describe('Title to show in the pretty log'),
        logMessage: z.string().optional().describe('Message before the JSON output'),
        indent: z.number().default(2).optional()
      }),
    },
    async handler(ctx) {
      const { method, path, headers, body, logTitle, logMessage, indent } = ctx.input;

      const response = await ctx.workspace.http.fetch(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      // Pretty log to backend
      const separator = '═'.repeat(60);
      const lines: string[] = [separator];
      if (logTitle) lines.push(`📋 ${logTitle.toUpperCase()}`, separator);
      if (logMessage) lines.push(logMessage, '');
      lines.push(JSON.stringify(data, null, indent));
      lines.push(separator);
      ctx.logger.info(lines.join('\n'));

      // Expose outputs for downstream steps
      ctx.output('body', data);
      ctx.output('status', response.status);
      ctx.output('headers', Object.fromEntries(response.headers.entries()));

      // Write file in workspace so UI can link to it
      const filePath = await ctx.workspace.writeFile(
        `enhanced-http-${Date.now()}.json`,
        JSON.stringify(data, null, indent)
      );
      ctx.output('filePath', filePath);
    },
  });
}
