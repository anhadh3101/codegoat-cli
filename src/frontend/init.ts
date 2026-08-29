import { styleText } from 'node:util';
import * as p from '@clack/prompts';
import { startSession } from './session.js';
import { clearScreen } from './clear.js';

export async function confirmWorkspace(): Promise<boolean> {
  clearScreen();
  p.intro(styleText('cyan', 'CodeGoat'));

  const build = await p.confirm({
    message: styleText(
      ['yellow', 'bold'],
      'Do you trust this workspace?',
    ),
    active: 'Yes, I trust it',
    inactive: 'No',
    initialValue: false,
  });

  if (p.isCancel(build) || !build) {
    p.cancel('Exiting.');
    return false;
  }

  return true;
}

export async function runInit(): Promise<void> {
  clearScreen();
  const code = await startSession();
  if (code !== 0) {
    process.exitCode = code;
  }
}
