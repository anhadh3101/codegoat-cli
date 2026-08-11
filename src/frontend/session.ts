import { spawn } from 'node:child_process';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const EXIT_COMMANDS = new Set(['/exit', '/quit', 'exit']);

function runCommand(command: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

export async function startSession(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log('Commands run as codegoat. Type /exit to quit.\n');

  try {
    while (true) {
      const line = (await rl.question('codegoat> ')).trim();
      if (!line) continue;
      if (EXIT_COMMANDS.has(line)) break;

      await runCommand(line);
    }
  } finally {
    rl.close();
  }
}
