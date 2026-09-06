import { Box } from 'ink';
import { Banner } from './Banner.js';
import { ConversationSelect } from './ConversationSelect.js';

export function SessionsScreen({
  bannerCwd,
  userId,
  columns,
  rows,
  onSelect,
  onCancel,
}: {
  bannerCwd: string;
  userId: string;
  columns: number;
  rows: number;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Box flexShrink={0}>
        <Banner cwd={bannerCwd} />
      </Box>

      <Box flexGrow={1} flexDirection="column">
        <ConversationSelect
          userId={userId}
          onSelect={onSelect}
          onCancel={onCancel}
        />
      </Box>
    </Box>
  );
}
