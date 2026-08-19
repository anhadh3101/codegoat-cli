import * as repl from 'node:repl';

export function startSession(): Promise<number> {
  console.log('Starting CodeGoat REPL. Type .exit to quit.\n');

  return new Promise((resolve) => {
    const r = repl.start({ prompt: 'codegoat> ' });

    r.on('exit', () => {
      resolve(0);
    });
  });
}
