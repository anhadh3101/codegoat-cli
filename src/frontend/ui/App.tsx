import { useCallback, useRef, useState } from 'react';
import { Box, Static, useApp, useInput } from 'ink';
import { type AgentState, runAgent } from '../../agent/agent.js';
import { extractText } from '../../agent/messages.js';
import { DEFAULT_MODEL, modelLabel } from '../../agent/models.js';
import { runCommand } from '../commands.js';
import type { TranscriptItem } from '../transcript.js';
import { Banner } from './Banner.js';
import { Message } from './Message.js';
import { ThinkingLine } from './ThinkingLine.js';
import { ModelSelect } from './ModelSelect.js';
import { Prompt } from './Prompt.js';

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export function App({ cwd }: { cwd: string }) {
  const { exit } = useApp();

  // Raw Anthropic history — the agent's source of truth. Mutated across turns.
  const stateRef = useRef<AgentState>({ messages: [], model: DEFAULT_MODEL });

  // Display transcript — drives <Static>. Append-only.
  const [items, setItems] = useState<TranscriptItem[]>([
    { kind: 'banner', id: 'banner', cwd },
  ]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'prompt' | 'model-select'>('prompt');
  const [model, setModel] = useState(DEFAULT_MODEL);

  useInput((input, key) => {
    if (key.ctrl && input === 'd') exit();
  });

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      if (text.startsWith('/')) {
        const result = runCommand(text);
        if (result.kind === 'exit') {
          exit();
          return;
        }
        if (result.kind === 'view') {
          setView(result.view);
          return;
        }
        setItems((prev) => [
          ...prev,
          { kind: 'error', id: nextId(), text: `Unknown command: ${text}` },
        ]);
        return;
      }

      setItems((prev) => [...prev, { kind: 'user', id: nextId(), text }]);
      stateRef.current.messages.push({ role: 'user', content: text });
      setBusy(true);

      try {
        const result = await runAgent(stateRef.current);
        stateRef.current.messages = result.messages;
        const last = result.messages[result.messages.length - 1];
        const reply = last ? extractText(last.content) : '';
        setItems((prev) => [
          ...prev,
          { kind: 'assistant', id: nextId(), text: reply },
        ]);
      } catch (err) {
        setItems((prev) => [
          ...prev,
          { kind: 'error', id: nextId(), text: (err as Error).message },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, exit],
  );

  return (
    <>
      <Static items={items}>
        {(item) =>
          item.kind === 'banner' ? (
            <Banner key={item.id} cwd={item.cwd} />
          ) : (
            <Message key={item.id} item={item} />
          )
        }
      </Static>

      <Box flexDirection="column">
        {busy && <ThinkingLine />}
        {view === 'model-select' ? (
          <ModelSelect
            current={model}
            onSelect={(value) => {
              setModel(value);
              stateRef.current.model = value;
              setItems((prev) => [
                ...prev,
                {
                  kind: 'info',
                  id: nextId(),
                  text: `Model set to ${modelLabel(value)}`,
                },
              ]);
              setView('prompt');
            }}
            onCancel={() => setView('prompt')}
          />
        ) : (
          <Prompt onSubmit={submit} disabled={busy} />
        )}
      </Box>
    </>
  );
}
