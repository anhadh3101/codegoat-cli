import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CODEGOAT_CHILD_ENV = 'CODEGOAT_CHILD';
const CODEGOAT_USER = 'codegoat';

export function isCodegoatChild(): boolean {
  return process.env[CODEGOAT_CHILD_ENV] === '1';
}

function resolveCliInvocation(): string[] {
  const distEntry = path.join(process.cwd(), 'dist', 'index.js');
  if (fs.existsSync(distEntry)) {
    return [process.execPath, distEntry];
  }

  const jsEntry = path.join(__dirname, '..', 'index.js');
  if (fs.existsSync(jsEntry)) {
    return [process.execPath, jsEntry];
  }

  throw new Error('CodeGoat is not built. Run: npm run build');
}


export function spawnChildProcess(): Promise<number> {
  const cliArgs = resolveCliInvocation();

  return new Promise((resolve, reject) => {
    const child = spawn(
      'sudo',
      ['-u', CODEGOAT_USER, '-E', ...cliArgs],
      {
        stdio: 'inherit',
        env: { ...process.env, [CODEGOAT_CHILD_ENV]: '1' },
      },
    );

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('sudo not found. CodeGoat requires sudo to run as the codegoat user.'));
        return;
      }
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
