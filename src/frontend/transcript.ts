export type TranscriptItem =
  | { kind: 'banner'; id: 'banner'; cwd: string }
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'error'; id: string; text: string };
