export type CommandResult =
  | { kind: 'exit' }
  | { kind: 'view'; view: 'model-select' }
  | { kind: 'unknown' };

type Command = {
  name: string;
  aliases?: string[];
  description: string;
  run: () => CommandResult;
};

const COMMANDS: Command[] = [
  {
    name: '/exit',
    aliases: ['/quit'],
    description: 'Exit CodeGoat',
    run: () => ({ kind: 'exit' }),
  },
  {
    name: '/model',
    description: 'Switch the model',
    run: () => ({ kind: 'view', view: 'model-select' }),
  },
];

export function runCommand(input: string): CommandResult {
  const name = input.trim().split(/\s+/)[0];
  const cmd = COMMANDS.find(
    (c) => c.name === name || c.aliases?.includes(name),
  );
  return cmd ? cmd.run() : { kind: 'unknown' };
}
