import * as p from '@clack/prompts';
import { startSession } from './session';
import { clearScreen } from './clear';

export async function runInit(): Promise<void> {
  clearScreen();

  p.intro('CodeGoat');

  const build = await p.confirm({
    message: 'Build in this workspace using CodeGoat',
  });

  if (p.isCancel(build) || !build) {
    p.cancel('Exiting.');
    return;
  }

  clearScreen();
  await startSession();
}
