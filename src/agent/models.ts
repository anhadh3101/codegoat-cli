export type ModelOption = { label: string; value: string };

export const MODELS: ModelOption[] = [
  { label: 'Sonnet 4.5', value: 'claude-sonnet-4-5' },
  { label: 'Opus 4.5', value: 'claude-opus-4-5' },
  { label: 'Haiku 4.5', value: 'claude-haiku-4-5' },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-5';

export const modelLabel = (value: string): string =>
  MODELS.find((m) => m.value === value)?.label ?? value;
