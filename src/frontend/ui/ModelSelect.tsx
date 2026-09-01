import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { MODELS } from '../../agent/models.js';

export function ModelSelect({
  current,
  onSelect,
  onCancel,
}: {
  current: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  const items = MODELS.map((m) => ({
    label: m.value === current ? `${m.label} (current)` : m.label,
    value: m.value,
  }));
  const initialIndex = Math.max(
    0,
    MODELS.findIndex((m) => m.value === current),
  );

  return (
    <Box flexDirection="column">
      <Text dimColor>Select a model (↑/↓, Enter to choose, Esc to cancel)</Text>
      <SelectInput
        items={items}
        initialIndex={initialIndex}
        onSelect={(item) => onSelect(item.value)}
      />
    </Box>
  );
}
