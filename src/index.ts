#!/usr/bin/env node
import { Command } from 'commander';
import { authCommand } from './commands/auth';
import { requireAuth } from './lib/requireAuth';
import { confirmWorkspace, runInit } from './frontend/init';
import { CODEGOAT_GROUP, CODEGOAT_USER } from './sandboxing/mac/constants';
import { createUserIfNotExists } from './sandboxing/mac/createUser';
import { removeUserIfExists } from './sandboxing/mac/deleteUser';
import { revokeTraverseGrants, scopeAccess } from './sandboxing/mac/scopeAccess';
import { isCodegoatChild, spawnChildProcess } from './sandboxing/mac/spawnChild';

function isAuthCommand(command: Command): boolean {
  let current: Command | null = command;
  while (current) {
    if (current.name() === 'auth') return true;
    current = current.parent ?? null;
  }
  return false;
}

const program = new Command();

// Integrate the auth commands to CodeGoat
program.addCommand(authCommand);

// Program details
program
  .name('codegoat')
  .description('CodeGoat CLI')
  .version('0.1.0');

// Check to see if it is an auth command, otherwise the tokens are always required.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  // Running auth commands does not require user to be authenticated.
  if (isAuthCommand(actionCommand)) return;
  // If the process's user is "codegoat", then auth is not required.
  if (isCodegoatChild()) return;
  await requireAuth();
});

// Running `codegoat` with no subcommand spawns a child process as the
// codegoat system user, then runs the init flow there.
program.action(async () => {
  if (!isCodegoatChild()) {
    const confirmed = await confirmWorkspace();
    if (!confirmed) {
      process.exit(0);
    }

    createUserIfNotExists(CODEGOAT_USER);

    let exitCode = 0;
    let exitSignal: NodeJS.Signals | null = null;

    const onSignal = (sig: NodeJS.Signals) => {
      revokeTraverseGrants();
      process.kill(process.pid, sig);
    };

    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);

    try {
      scopeAccess(process.cwd());
      const result = await spawnChildProcess();
      exitCode = result.code ?? 1;
      exitSignal = result.signal;
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      revokeTraverseGrants();
    }

    if (exitSignal) {
      process.kill(process.pid, exitSignal);
    } else {
      process.exit(exitCode);
    }
  }

  await runInit();
});

const resetCommand = program.command('reset').description('Reset CodeGoat sandbox state');

resetCommand
  .command('user')
  .description('Remove the codegoat sandbox user and group')
  .action(() => {
    const result = removeUserIfExists(CODEGOAT_USER, CODEGOAT_GROUP);

    if (!result.userRemoved && !result.groupRemoved) {
      console.log(`Nothing to remove: '${CODEGOAT_USER}' user and '${CODEGOAT_GROUP}' group do not exist.`);
      return;
    }

    if (result.userRemoved) console.log(`Removed user '${CODEGOAT_USER}'.`);
    if (result.groupRemoved) console.log(`Removed group '${CODEGOAT_GROUP}'.`);
  });

program
  .command('hello')
  .description('Say hello')
  .argument('[name]', 'Name to greet', 'world')
  .action((name: string) => {
    console.log(`Hello, ${name}!`);
  });

program.parse();
