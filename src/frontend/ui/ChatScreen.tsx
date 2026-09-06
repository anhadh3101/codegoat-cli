import { Box } from 'ink';
import type { MessageItem } from '../transcript.js';
import type { AppView } from '../commands.js';
import { Banner } from './Banner.js';
import { ModelSelect } from './ModelSelect.js';
import { Prompt } from './Prompt.js';
import { ScrollableTranscript } from './ScrollableTranscript.js';
import { ThinkingLine } from './ThinkingLine.js';

export function ChatScreen({
  bannerCwd,
  items,
  columns,
  rows,
  viewportRows,
  scrollFromBottom,
  busy,
  view,
  model,
  onSubmit,
  onOpenConversations,
  onModelSelect,
  onModelCancel,
}: {
  bannerCwd: string;
  items: MessageItem[];
  columns: number;
  rows: number;
  viewportRows: number;
  scrollFromBottom: number;
  busy: boolean;
  view: Extract<AppView, 'prompt' | 'model-select'>;
  model: string;
  onSubmit: (value: string) => void;
  onOpenConversations: () => void;
  onModelSelect: (value: string) => void;
  onModelCancel: () => void;
}) {
  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Box flexShrink={0}>
        <Banner cwd={bannerCwd} />
      </Box>

      <ScrollableTranscript
        items={items}
        columns={columns}
        viewportRows={viewportRows}
        scrollFromBottom={scrollFromBottom}
      />

      <Box flexShrink={0} flexDirection="column">
        {busy && <ThinkingLine />}
        {view === 'model-select' ? (
          <ModelSelect
            current={model}
            onSelect={onModelSelect}
            onCancel={onModelCancel}
          />
        ) : (
          <Prompt
            onSubmit={onSubmit}
            onOpenConversations={onOpenConversations}
            disabled={busy}
          />
        )}
      </Box>
    </Box>
  );
}
