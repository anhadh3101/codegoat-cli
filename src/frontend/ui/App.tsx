import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Static, useApp, useInput } from 'ink';
import { type AgentState, runAgent } from '../../agent/agent.js';
import { extractText } from '../../agent/messages.js';
import { DEFAULT_MODEL, modelLabel } from '../../agent/models.js';
import { CODEGOAT_USER_SUB_ENV, getValidToken } from '../../lib/auth.js';
import { getUserInfo } from '../../lib/auth0.js';
import {
  createConversation,
  loadConversation,
  saveTurn,
  type DisplayRow,
} from '../../lib/conversations.js';
import { clearScreen } from '../clear.js';
import { type AppView, runCommand } from '../commands.js';
import type { TranscriptItem } from '../transcript.js';
import { Banner } from './Banner.js';
import {
  ConversationSelect,
  NEW_CONVERSATION,
} from './ConversationSelect.js';
import { Message } from './Message.js';
import { ThinkingLine } from './ThinkingLine.js';
import { ModelSelect } from './ModelSelect.js';
import { Prompt } from './Prompt.js';

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

function truncateTitle(text: string, max = 50): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function storedMessagesToItems(
  bannerCwd: string,
  messages: DisplayRow[],
): TranscriptItem[] {
  return [
    { kind: 'banner', id: 'banner', cwd: bannerCwd },
    ...messages.map((m) => ({
      kind: m.role,
      id: nextId(),
      text: m.content,
    })),
  ];
}

export function App({ cwd }: { cwd: string }) {
  const { exit } = useApp();

  const stateRef = useRef<AgentState>({ messages: [], model: DEFAULT_MODEL });
  const conversationIdRef = useRef<string | null>(null);

  const [items, setItems] = useState<TranscriptItem[]>([
    { kind: 'banner', id: 'banner', cwd },
  ]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<AppView>('prompt');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState('new');

  useEffect(() => {
    const envSub = process.env[CODEGOAT_USER_SUB_ENV];
    if (envSub) {
      setUserId(envSub);
      return;
    }

    getValidToken()
      .then((token) => {
        if (!token) return;
        return getUserInfo(token);
      })
      .then((info) => {
        if (info?.sub) setUserId(info.sub);
      })
      .catch(() => {
        // Chat works without persistence.
      });
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'd') exit();
  });

  const appendInfo = useCallback((text: string) => {
    setItems((prev) => [
      ...prev,
      { kind: 'info', id: nextId(), text },
    ]);
  }, []);

  const persistTurn = useCallback(
    async (displayRows: DisplayRow[]) => {
      const uid = userId;
      if (!uid || displayRows.length === 0) return;

      try {
        let convId = conversationIdRef.current;
        if (!convId) {
          const firstUser = displayRows.find((r) => r.role === 'user');
          convId = await createConversation({
            userId: uid,
            title: truncateTitle(firstUser?.content ?? 'New conversation'),
            cwd,
            model: stateRef.current.model ?? DEFAULT_MODEL,
          });
          conversationIdRef.current = convId;
          setSessionKey(convId);
        }

        await saveTurn({
          conversationId: convId,
          userId: uid,
          model: stateRef.current.model ?? DEFAULT_MODEL,
          agentMessages: stateRef.current.messages,
          displayRows,
        });
      } catch (err) {
        appendInfo(
          `Could not save conversation: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [userId, cwd, appendInfo],
  );

  const resetConversation = useCallback(() => {
    clearScreen();
    conversationIdRef.current = null;
    stateRef.current = { messages: [], model };
    setItems([{ kind: 'banner', id: 'banner', cwd }]);
    setSessionKey(`new-${Date.now()}`);
    setView('prompt');
  }, [cwd, model]);

  const openConversationSelect = useCallback(() => {
    if (busy) return;
    if (!userId) {
      appendInfo('Log in to switch conversations.');
      return;
    }
    setView('conversation-select');
  }, [busy, userId, appendInfo]);

  const selectConversation = useCallback(
    async (value: string) => {
      if (value === NEW_CONVERSATION) {
        resetConversation();
        return;
      }

      const uid = userId;
      if (!uid) {
        setView('prompt');
        return;
      }

      try {
        const loaded = await loadConversation(value, uid);
        if (!loaded) {
          appendInfo('Conversation not found.');
          setView('prompt');
          return;
        }

        clearScreen();
        conversationIdRef.current = loaded.id;
        stateRef.current = {
          messages: loaded.agentMessages,
          model: loaded.model,
        };
        setModel(loaded.model);
        setItems(
          storedMessagesToItems(loaded.cwd ?? cwd, loaded.messages),
        );
        setSessionKey(loaded.id);
        setView('prompt');
      } catch (err) {
        appendInfo(
          `Could not load conversation: ${err instanceof Error ? err.message : String(err)}`,
        );
        setView('prompt');
      }
    },
    [userId, cwd, resetConversation, appendInfo],
  );

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

      const displayRows: DisplayRow[] = [{ role: 'user', content: text }];

      try {
        const result = await runAgent(stateRef.current);
        stateRef.current.messages = result.messages;
        const last = result.messages[result.messages.length - 1];
        const reply = last ? extractText(last.content) : '';
        setItems((prev) => [
          ...prev,
          { kind: 'assistant', id: nextId(), text: reply },
        ]);
        displayRows.push({ role: 'assistant', content: reply });
      } catch (err) {
        const message = (err as Error).message;
        setItems((prev) => [
          ...prev,
          { kind: 'error', id: nextId(), text: message },
        ]);
        displayRows.push({ role: 'error', content: message });
      } finally {
        setBusy(false);
        await persistTurn(displayRows);
      }
    },
    [busy, exit, persistTurn],
  );

  return (
    <>
      <Static key={sessionKey} items={items}>
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
        ) : view === 'conversation-select' && userId ? (
          <ConversationSelect
            userId={userId}
            onSelect={selectConversation}
            onCancel={() => setView('prompt')}
          />
        ) : (
          <Prompt
            onSubmit={submit}
            onOpenConversations={openConversationSelect}
            disabled={busy}
          />
        )}
      </Box>
    </>
  );
}
