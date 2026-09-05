import fs from 'node:fs';
import path from 'node:path';

export function ensureWorkspaceDir(cwd: string = process.cwd()): void {
  const dir = path.join(cwd, '.codegoat');
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir);
}
