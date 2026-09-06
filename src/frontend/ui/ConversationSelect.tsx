import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import {
  listConversations,
  type ConversationSummary,
} from '../../persistence/conversations.js';

export const NEW_CONVERSATION = '__new__';

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatLabel(conv: ConversationSummary): string {
  const title = conv.title?.trim() || 'Untitled';
  const truncated =
    title.length > 40 ? `${title.slice(0, 37)}...` : title;
  return `${truncated}  · ${formatRelativeTime(conv.updatedAt)}`;
}

export function ConversationSelect({
  userId,
  onSelect,
  onCancel,
}: {
  userId: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  useEffect(() => {
    let cancelled = false;

    listConversations(userId)
      .then((rows) => {
        if (!cancelled) {
          setConversations(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <Text dimColor>Loading conversations...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to load conversations: {error}</Text>
        <Text dimColor>Press Esc to go back</Text>
      </Box>
    );
  }

  const items = [
    { label: 'New conversation', value: NEW_CONVERSATION },
    ...conversations.map((c) => ({
      label: formatLabel(c),
      value: c.id,
    })),
  ];

  return (
    <Box flexDirection="column">
      <Text dimColor>
        Select a conversation (↑/↓, Enter to choose, Esc to cancel)
      </Text>
      <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
    </Box>
  );
}
