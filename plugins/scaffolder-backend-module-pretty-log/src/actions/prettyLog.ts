import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

/**
 * Creates an action that logs data with pretty JSON formatting
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
      
      // Add top separator
      lines.push(separator);
      
      // Add title if provided
      if (title) {
        lines.push(`📋 ${title.toUpperCase()}`);
        lines.push(separator);
      }
      
      // Add message if provided
      if (message) {
        lines.push(message);
        lines.push('');
      }
      
      // Pretty print the data
      try {
        const prettyJson = JSON.stringify(data, null, indent);
        lines.push(prettyJson);
      } catch (error) {
        // If JSON stringification fails, just convert to string
        lines.push(String(data));
        ctx.logger.warn(`Failed to stringify data as JSON: ${error}`);
      }
      
      // Add bottom separator
      lines.push(separator);
      
      // Log everything
      ctx.logger.info(lines.join('\n'));
    },
  });
}