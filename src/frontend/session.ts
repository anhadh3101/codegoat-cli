import * as repl from 'node:repl';
import { AgentState, runAgent } from '../agent/agent';

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
          const reply = state.messages[state.messages.length - 1]?.content ?? '';
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
