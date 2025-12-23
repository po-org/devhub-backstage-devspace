import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

const inputSchema = z.object({
  stepName: z.string().describe('The ID of the step whose HTTP output you want to format'),
});

export function createHttpPrettyOutputAction() {
  return createTemplateAction({
    id: 'http-pretty-output',
    description: 'Formats the output of a previous HTTP request step into human-readable JSON',
    schema: { input: inputSchema, output: z.object({ prettyJson: z.string() }) },

    async handler(ctx) {
      const { input, logger, output, steps } = ctx;

      const stepOutput = steps[input.stepName]?.output;
      if (!stepOutput) {
        throw new Error(`No output found for step '${input.stepName}'`);
      }

      let parsedBody: any;
      const rawBody = stepOutput.body;

      // Attempt to parse JSON, fallback to string
      if (typeof rawBody === 'string') {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody; // not JSON, keep as string
        }
      } else {
        parsedBody = rawBody; // could be object/array already
      }

      const structured = {
        summary: {
          success: stepOutput.code >= 200 && stepOutput.code < 300,
          status: stepOutput.code ?? 0,
          durationMs: stepOutput.durationMs ?? 0,
        },
        request: {
          method: stepOutput.method ?? 'UNKNOWN',
          url: stepOutput.url ?? 'UNKNOWN',
          timestamp: stepOutput.timestamp ?? new Date().toISOString(),
        },
        response: {
          headers: stepOutput.headers ?? {},
        },
        data: parsedBody,
      };

      output('prettyJson', JSON.stringify(structured, null, 2));
      logger.info(`Pretty JSON generated for step '${input.stepName}'`);
    },
  });
}
