import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const EXIT_COMMANDS = new Set(['/exit', '/quit']);

// Minimal placeholder chat loop. Replace with the graph agent REPL later.
export async function startSession(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log('Chat ready. Type /exit to quit.\n');

  try {
    while (true) {
      const line = (await rl.question('> ')).trim();
      if (!line) continue;
      if (EXIT_COMMANDS.has(line)) break;

      console.log('(placeholder) Received your message.\n');
    }
  } finally {
    rl.close();
  }
}
