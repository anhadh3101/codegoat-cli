#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { authCommand } from './commands/auth';
import { requireAuth } from './lib/requireAuth';

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

program
  .name('codegoat')
  .description('CodeGoat CLI')
  .version('0.1.0');

// Check to see if it is an auth command, otherwise the tokens are always required.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return;
  await requireAuth();
});

program
  .command('hello')
  .description('Say hello')
  .argument('[name]', 'Name to greet', 'world')
  .action((name: string) => {
    console.log(`Hello, ${name}!`);
  });

program.parse();
