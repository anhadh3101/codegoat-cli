import { Text } from 'ink';
import Spinner from 'ink-spinner';

export function ThinkingLine() {
  return (
    <Text dimColor>
      <Spinner type="dots" /> Thinking…
    </Text>
  );
}
