import type Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ClientTool, ToolResult } from '../toolNode';

const viewSchema = z.object({
  command: z.literal('view'),
  path: z.string(),
  view_range: z.tuple([z.number(), z.number()]).optional(),
});

const createSchema = z.object({
  command: z.literal('create'),
  path: z.string(),
  file_text: z.string(),
});

const strReplaceSchema = z.object({
  command: z.literal('str_replace'),
  path: z.string(),
  old_str: z.string(),
  new_str: z.string(),
});

const insertSchema = z.object({
  command: z.literal('insert'),
  path: z.string(),
  insert_line: z.number(),
  new_str: z.string(),
});

const textEditorInputSchema = z.discriminatedUnion('command', [
  viewSchema,
  createSchema,
  strReplaceSchema,
  insertSchema,
]);

export const textEditorTool: Anthropic.ToolTextEditor20250728 = {
  type: 'text_editor_20250728',
  name: 'str_replace_based_edit_tool',
};

function view(input: z.infer<typeof viewSchema>): ToolResult {
  const target = path.resolve(input.path);
  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    return { content: fs.readdirSync(target).join('\n') };
  }

  const lines = fs.readFileSync(target, 'utf8').split('\n');
  const [start, end] = input.view_range ?? [1, lines.length];
  const numbered = lines
    .slice(start - 1, end)
    .map((line, i) => `${start + i}\t${line}`)
    .join('\n');

  return { content: numbered };
}

function create(input: z.infer<typeof createSchema>): ToolResult {
  const target = path.resolve(input.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, input.file_text);
  return { content: `File created: ${input.path}` };
}

// old_str must match exactly once — no fuzzy/regex matching, per the
// text_editor_20250728 contract.
function strReplace(input: z.infer<typeof strReplaceSchema>): ToolResult {
  const target = path.resolve(input.path);
  const content = fs.readFileSync(target, 'utf8');
  const occurrences = content.split(input.old_str).length - 1;

  if (occurrences === 0) {
    return { content: `old_str not found in ${input.path}`, isError: true };
  }
  if (occurrences > 1) {
    return {
      content: `old_str matches ${occurrences} times in ${input.path}; must match exactly once`,
      isError: true,
    };
  }

  fs.writeFileSync(target, content.replace(input.old_str, input.new_str));
  return { content: `File edited: ${input.path}` };
}

function insert(input: z.infer<typeof insertSchema>): ToolResult {
  const target = path.resolve(input.path);
  const lines = fs.readFileSync(target, 'utf8').split('\n');

  if (input.insert_line < 0 || input.insert_line > lines.length) {
    return { content: `insert_line ${input.insert_line} out of range`, isError: true };
  }

  lines.splice(input.insert_line, 0, input.new_str);
  fs.writeFileSync(target, lines.join('\n'));
  return { content: `Inserted into ${input.path} at line ${input.insert_line}` };
}

async function executeTextEditor(rawInput: unknown): Promise<ToolResult> {
  try {
    const input = textEditorInputSchema.parse(rawInput);

    switch (input.command) {
      case 'view':
        return view(input);
      case 'create':
        return create(input);
      case 'str_replace':
        return strReplace(input);
      case 'insert':
        return insert(input);
    }
  } catch (err) {
    return { content: err instanceof Error ? err.message : String(err), isError: true };
  }
}

export const textEditorClientTool: ClientTool = {
  definition: textEditorTool,
  execute: executeTextEditor,
};
