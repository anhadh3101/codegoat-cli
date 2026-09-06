import { Box } from 'ink';
import type { MessageItem } from '../transcript.js';
import { Message } from './Message.js';
import { getVisibleMessages } from './transcriptScroll.js';

export function ScrollableTranscript({
  items,
  columns,
  viewportRows,
  scrollFromBottom,
}: {
  items: MessageItem[];
  columns: number;
  viewportRows: number;
  scrollFromBottom: number;
}) {
  const visible = getVisibleMessages(
    items,
    columns,
    viewportRows,
    scrollFromBottom,
  );

  return (
    <Box
      flexDirection="column"
      height={viewportRows}
      overflow="hidden"
      justifyContent="flex-end"
    >
      {visible.map((item) => (
        <Message key={item.id} item={item} />
      ))}
    </Box>
  );
}
