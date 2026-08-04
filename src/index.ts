#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('codegoat')
  .description('CodeGoat CLI')
  .version('0.1.0');

program
  .command('hello')
  .description('Say hello')
  .argument('[name]', 'Name to greet', 'world')
  .action((name: string) => {
    console.log(`Hello, ${name}!`);
  });

program.parse();
