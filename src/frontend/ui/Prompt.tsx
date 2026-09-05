import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export function Prompt({
  onSubmit,
  onOpenConversations,
  disabled,
}: {
  onSubmit: (value: string) => void;
  onOpenConversations: () => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');

  useInput(
    (_input, key) => {
      if (value === '' && key.leftArrow) {
        onOpenConversations();
      }
    },
    { isActive: !disabled },
  );

  const submit = (raw: string) => {
    setValue('');
    onSubmit(raw);
  };

  return (
    <Box>
      <Text color={disabled ? 'gray' : 'cyan'}>{'❯ '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={submit}
        focus={!disabled}
        showCursor={!disabled}
      />
    </Box>
  );
}
