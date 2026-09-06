import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useInput, useStdout } from 'ink';
import { type AgentState, runAgent } from '../../agent/agent.js';
import { extractText } from '../../agent/messages.js';
import { DEFAULT_MODEL, modelLabel } from '../../agent/models.js';
import { CODEGOAT_USER_SUB_ENV, getValidToken } from '../../authentication/auth.js';
import { getUserInfo } from '../../authentication/auth0.js';
import {
  createConversation,
  loadConversation,
  saveTurn,
  type DisplayRow,
} from '../../persistence/conversations.js';
import { clearScreen } from '../clear.js';
import { type AppView, runCommand } from '../commands.js';
import type { MessageItem } from '../transcript.js';
import { ChatScreen } from './ChatScreen.js';
import { NEW_CONVERSATION } from './ConversationSelect.js';
import { SessionsScreen } from './SessionsScreen.js';
import {
  clampScrollFromBottom,
  maxScrollFromBottom,
  transcriptViewportRows,
} from './transcriptScroll.js';

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

function truncateTitle(text: string, max = 50): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function storedMessagesToItems(messages: DisplayRow[]): MessageItem[] {
  return messages.map((m) => ({
    kind: m.role,
    id: nextId(),
    text: m.content,
  }));
}

export function App({ cwd }: { cwd: string }) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const stateRef = useRef<AgentState>({ messages: [], model: DEFAULT_MODEL });
  const conversationIdRef = useRef<string | null>(null);
  const pinnedToBottomRef = useRef(true);

  const [items, setItems] = useState<MessageItem[]>([]);
  const [bannerCwd, setBannerCwd] = useState(cwd);
  const [scrollFromBottom, setScrollFromBottom] = useState(0);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<AppView>('prompt');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [userId, setUserId] = useState<string | null>(null);
  const [terminalSize, setTerminalSize] = useState({
    rows: stdout.rows,
    columns: stdout.columns,
  });

  useEffect(() => {
    const onResize = () => {
      setTerminalSize({ rows: stdout.rows, columns: stdout.columns });
    };

    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

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

  const chatView = view === 'model-select' ? 'model-select' : 'prompt';
  const viewportRows = transcriptViewportRows(
    terminalSize.rows,
    chatView,
    busy,
  );

  useEffect(() => {
    if (view !== 'prompt') return;

    if (pinnedToBottomRef.current) {
      setScrollFromBottom(0);
      return;
    }

    setScrollFromBottom((current) =>
      clampScrollFromBottom(
        current,
        items,
        terminalSize.columns,
        viewportRows,
      ),
    );
  }, [items, terminalSize.columns, viewportRows, view]);

  useInput(
    (_input, key) => {
      if (view !== 'prompt') return;

      const pageStep = Math.max(1, Math.floor(viewportRows / 2));

      if (key.pageUp) {
        pinnedToBottomRef.current = false;
        setScrollFromBottom((current) =>
          clampScrollFromBottom(
            current + pageStep,
            items,
            terminalSize.columns,
            viewportRows,
          ),
        );
        return;
      }

      if (key.pageDown) {
        setScrollFromBottom((current) => {
          const next = clampScrollFromBottom(
            current - pageStep,
            items,
            terminalSize.columns,
            viewportRows,
          );
          if (next === 0) pinnedToBottomRef.current = true;
          return next;
        });
        return;
      }

      if (key.home) {
        pinnedToBottomRef.current = false;
        setScrollFromBottom(
          maxScrollFromBottom(items, terminalSize.columns, viewportRows),
        );
        return;
      }

      if (key.end) {
        pinnedToBottomRef.current = true;
        setScrollFromBottom(0);
      }
    },
    { isActive: view === 'prompt' && !busy },
  );

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
    pinnedToBottomRef.current = true;
    setScrollFromBottom(0);
    setItems([]);
    setBannerCwd(cwd);
    setView('prompt');
  }, [cwd, model]);

  const openConversationSelect = useCallback(() => {
    if (busy) return;
    if (!userId) {
      appendInfo('Log in to switch conversations.');
      return;
    }
    clearScreen();
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
        pinnedToBottomRef.current = true;
        setScrollFromBottom(0);
        setBannerCwd(loaded.cwd ?? cwd);
        setItems(storedMessagesToItems(loaded.messages));
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
          clearScreen();
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
      pinnedToBottomRef.current = true;
      setScrollFromBottom(0);
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

  const handleModelSelect = useCallback(
    (value: string) => {
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
    },
    [],
  );

  if (view === 'conversation-select' && userId) {
    return (
      <SessionsScreen
        bannerCwd={bannerCwd}
        userId={userId}
        columns={terminalSize.columns}
        rows={terminalSize.rows}
        onSelect={selectConversation}
        onCancel={() => {
          clearScreen();
          setView('prompt');
        }}
      />
    );
  }

  return (
    <ChatScreen
      bannerCwd={bannerCwd}
      items={items}
      columns={terminalSize.columns}
      rows={terminalSize.rows}
      viewportRows={viewportRows}
      scrollFromBottom={scrollFromBottom}
      busy={busy}
      view={chatView}
      model={model}
      onSubmit={submit}
      onOpenConversations={openConversationSelect}
      onModelSelect={handleModelSelect}
      onModelCancel={() => setView('prompt')}
    />
  );
}
