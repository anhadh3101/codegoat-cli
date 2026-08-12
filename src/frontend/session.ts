import { spawn } from 'node:child_process';

function resolveShell(): string {
  return process.env.SHELL || '/bin/zsh';
}

export function startSession(): Promise<number> {
  const shell = resolveShell();

  console.log('Starting shell as codegoat. Type exit to quit.\n');

  return new Promise((resolve, reject) => {
    const child = spawn(shell, ['-i'], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 0);
    });
  });
}
