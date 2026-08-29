import { render } from 'ink';
import { App } from './ui/App.js';

export function startSession(): Promise<number> {
  if (!process.stdin.isTTY) {
    console.error('CodeGoat requires an interactive terminal.');
    return Promise.resolve(1);
  }

  const instance = render(<App cwd={process.cwd()} />, { exitOnCtrlC: true });

  // The old REPL always resolved 0 on a clean exit; only a render crash is non-zero.
  return instance.waitUntilExit().then(
    () => 0,
    (err) => {
      console.error(err);
      return 1;
    },
  );
}
