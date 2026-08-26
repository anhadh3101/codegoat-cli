import type Anthropic from '@anthropic-ai/sdk';
import execa from 'execa';
import { z } from 'zod';
import type { ClientTool, ToolResult } from '../toolNode';

const bashInputSchema = z.object({
  command: z.string().optional(),
  restart: z.boolean().optional(),
});

// Tracks cwd across calls so the tool behaves like one persistent shell
// session; `restart: true` is the only way a caller can reset it.
let sessionCwd = process.cwd();

export const bashTool: Anthropic.ToolBash20250124 = {
  type: 'bash_20250124',
  name: 'bash',
};

async function executeBash(rawInput: unknown): Promise<ToolResult> {
  const input = bashInputSchema.parse(rawInput);

  if (input.restart) {
    sessionCwd = process.cwd();
    return { content: 'bash session restarted' };
  }

  if (!input.command) {
    return { content: 'No command provided.', isError: true };
  }

  try {
    const result = await execa(input.command, {
      shell: true,
      cwd: sessionCwd,
      all: true,
      reject: false,
    });

    return {
      content: result.all || '(no output)',
      isError: result.exitCode !== 0,
    };
  } catch (err) {
    return { content: err instanceof Error ? err.message : String(err), isError: true };
  }
}

export const bashClientTool: ClientTool = {
  definition: bashTool,
  execute: executeBash,
};
