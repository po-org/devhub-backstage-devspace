import fs from 'fs/promises';
import path from 'path';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

/**
 * Creates an action that logs data with pretty JSON formatting
 * and exposes it as a workspace file for UI links
 *
 * @public
 */
export function createPrettyLogAction() {
  return createTemplateAction({
    id: 'debug:log:pretty',
    description: 'Logs data with pretty JSON formatting for better readability',
    schema: {
      input: z.object({
        data: z.any().describe('The data to pretty print (will be JSON stringified)'),
        title: z.string().optional().describe('Optional title to display above the data'),
        indent: z.number().default(2).optional().describe('Number of spaces for indentation (default: 2)'),
        message: z.string().optional().describe('Optional message to display before the data'),
      }),
    },

    async handler(ctx) {
      const { data, title, indent = 2, message } = ctx.input;

      const separator = '═'.repeat(60);
      const lines: string[] = [];

      // Backend logging
      lines.push(separator);
      if (title) {
        lines.push(`📋 ${title.toUpperCase()}`);
        lines.push(separator);
      }
      if (message) {
        lines.push(message);
        lines.push('');
      }

      try {
        const prettyJson = JSON.stringify(data, null, indent);
        lines.push(prettyJson);
      } catch (error) {
        lines.push(String(data));
        ctx.logger.warn(`Failed to stringify data as JSON: ${error}`);
      }

      lines.push(separator);
      ctx.logger.info(lines.join('\n'));

      // --- Write JSON to workspace so UI can link to it ---
      const filePath = path.join(ctx.workspacePath, 'debug-output.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, indent), 'utf-8');

      // Return the file path for template output links
      return {
        filePath: 'debug-output.json',
      };
    },
  });
}
