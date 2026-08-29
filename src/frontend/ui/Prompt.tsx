import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export function Prompt({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');

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
