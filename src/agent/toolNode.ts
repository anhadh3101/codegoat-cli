import type Anthropic from '@anthropic-ai/sdk';
import { clientToolsByName } from './tools/index.js';

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface ClientTool {
  definition: Anthropic.ToolBash20250124 | Anthropic.ToolTextEditor20250728;
  execute(input: unknown): Promise<ToolResult>;
}

interface ToolCallState {
  messages: Anthropic.MessageParam[];
}

function pendingClientToolUseBlocks(state: ToolCallState): Anthropic.ToolUseBlockParam[] {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') return [];

  const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
  return content.filter(
    (block): block is Anthropic.ToolUseBlockParam =>
      block.type === 'tool_use' && block.name in clientToolsByName,
  );
}

export function hasPendingClientToolCall(state: ToolCallState): boolean {
  return pendingClientToolUseBlocks(state).length > 0;
}

export async function toolNode<S extends ToolCallState>(state: S): Promise<Partial<S>> {
  const toolUseBlocks = pendingClientToolUseBlocks(state);

  const resultBlocks: Anthropic.ToolResultBlockParam[] = await Promise.all(
    toolUseBlocks.map(async (block) => {
      const tool = clientToolsByName[block.name];
      try {
        const result = await tool.execute(block.input);
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result.content,
          is_error: result.isError,
        };
      } catch (err) {
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: err instanceof Error ? err.message : String(err),
          is_error: true,
        };
      }
    }),
  );

  const update = { messages: [...state.messages, { role: 'user' as const, content: resultBlocks }] };
  return update as Partial<S>;
}
