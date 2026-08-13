import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GROUP = 'codegoatshared';

function hasSearchAce(dir: string): boolean {
  const out = execFileSync('ls', ['-lde', dir], { encoding: 'utf8' });
  return new RegExp(`group:${GROUP} allow.*search`).test(out);
}

function isWorldTraversable(dir: string): boolean {
  const mode = fs.statSync(dir).mode;
  return (mode & 0o001) !== 0;
}

function grantTraverse(dir: string): void {
  if (hasSearchAce(dir)) return;
  execFileSync('chmod', ['+a', `group:${GROUP} allow search`, dir]);
}

function scopeTargetDirectory(targetDir: string): void {
  execFileSync('chgrp', ['-R', GROUP, targetDir]);
  execFileSync('chmod', ['-R', 'u+rwX,g+rwX,o-rwx', targetDir]);
  execFileSync('chmod', ['g+s', targetDir]);
  execFileSync('chmod', ['+t', targetDir]);
}

function grantTraverseOnAncestors(targetDir: string): void {
  let dir = path.dirname(targetDir);

  while (dir !== '/' && dir !== path.dirname(dir)) {
    if (isWorldTraversable(dir) || hasSearchAce(dir)) break;
    grantTraverse(dir);
    dir = path.dirname(dir);
  }
}

export function scopeAccess(targetDir: string): void {
  const resolved = path.resolve(targetDir);
  scopeTargetDirectory(resolved);
  grantTraverseOnAncestors(resolved);
}
