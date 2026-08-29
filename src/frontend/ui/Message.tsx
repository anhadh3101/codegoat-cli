import { Box, Text } from 'ink';
import type { TranscriptItem } from '../transcript.js';

type MessageItem = Exclude<TranscriptItem, { kind: 'banner' }>;

export function Message({ item }: { item: MessageItem }) {
  if (item.kind === 'user') {
    return (
      <Box marginBottom={1}>
        <Text color="green">{'> '}</Text>
        <Text>{item.text}</Text>
      </Box>
    );
  }

  if (item.kind === 'error') {
    return (
      <Box marginBottom={1}>
        <Text color="red">{item.text}</Text>
      </Box>
    );
  }

  // assistant — plain text for now.
  // Later: swap <Text> for a <Markdown> component, add tool-status rows above.
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>{item.text}</Text>
    </Box>
  );
}
