import { Box, Text } from 'ink';

export function Banner({ cwd }: { cwd: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        CodeGoat
      </Text>
      <Text dimColor>{cwd}</Text>
    </Box>
  );
}
