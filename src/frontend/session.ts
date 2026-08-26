import * as repl from 'node:repl';
import type Anthropic from '@anthropic-ai/sdk';
import { AgentState, runAgent } from '../agent/agent';

function extractText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;

  return content
    .filter((block): block is Anthropic.TextBlockParam => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function startSession(): Promise<number> {
  console.log('Starting CodeGoat agent REPL. Type .exit to quit.\n');

  const state: AgentState = { messages: [] };

  return new Promise((resolve) => {
    const r = repl.start({
      prompt: 'codegoat> ',
      writer: (output) => (typeof output === 'string' ? output : ''),
      eval: async (cmd, _context, _filename, callback) => {
        const input = cmd.trim();
        if (!input) {
          callback(null, undefined);
          return;
        }

        state.messages.push({ role: 'user', content: input });

        try {
          const result = await runAgent(state);
          state.messages = result.messages;
          const last = state.messages[state.messages.length - 1];
          const reply = last ? extractText(last.content) : '';
          callback(null, reply);
        } catch (err) {
          callback(err as Error, undefined);
        }
      },
    });

    r.on('exit', () => {
      resolve(0);
    });
  });
}
