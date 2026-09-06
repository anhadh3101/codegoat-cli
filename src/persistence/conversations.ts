import type Anthropic from '@anthropic-ai/sdk';
import { getPool } from './db.js';

export type ConversationSummary = {
  id: string;
  title: string | null;
  model: string;
  updatedAt: Date;
};

export type StoredMessage = {
  role: 'user' | 'assistant' | 'error' | 'info';
  content: string;
  position: number;
};

export type LoadedConversation = {
  id: string;
  title: string | null;
  cwd: string | null;
  model: string;
  agentMessages: Anthropic.MessageParam[];
  messages: StoredMessage[];
};

export type DisplayRow = {
  role: StoredMessage['role'];
  content: string;
};

export async function listConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  const { rows } = await getPool().query<{
    id: string;
    title: string | null;
    model: string;
    updated_at: Date;
  }>(
    `SELECT id, title, model, updated_at
     FROM session
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    model: row.model,
    updatedAt: row.updated_at,
  }));
}

export async function loadConversation(
  id: string,
  userId: string,
): Promise<LoadedConversation | null> {
  const pool = getPool();

  const { rows: convRows } = await pool.query<{
    id: string;
    title: string | null;
    cwd: string | null;
    model: string;
    agent_messages: Anthropic.MessageParam[];
  }>(
    `SELECT id, title, cwd, model, agent_messages
     FROM session
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  const conv = convRows[0];
  if (!conv) return null;

  const { rows: msgRows } = await pool.query<{
    role: StoredMessage['role'];
    content: string;
    position: number;
  }>(
    `SELECT role, content, position
     FROM messages
     WHERE session_id = $1
     ORDER BY position`,
    [id],
  );

  return {
    id: conv.id,
    title: conv.title,
    cwd: conv.cwd,
    model: conv.model,
    agentMessages: conv.agent_messages,
    messages: msgRows,
  };
}

export async function createConversation(input: {
  userId: string;
  title: string;
  cwd: string;
  model: string;
}): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO session (user_id, title, cwd, model)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.userId, input.title, input.cwd, input.model],
  );

  return rows[0]!.id;
}

export async function saveTurn(input: {
  conversationId: string;
  userId: string;
  model: string;
  agentMessages: Anthropic.MessageParam[];
  displayRows: DisplayRow[];
}): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE session
       SET model = $1, agent_messages = $2::jsonb, updated_at = now()
       WHERE id = $3 AND user_id = $4`,
      [
        input.model,
        JSON.stringify(input.agentMessages),
        input.conversationId,
        input.userId,
      ],
    );

    const { rows: posRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next
       FROM messages
       WHERE session_id = $1`,
      [input.conversationId],
    );

    let position = posRows[0]?.next ?? 0;

    for (const row of input.displayRows) {
      await client.query(
        `INSERT INTO messages (session_id, position, role, content)
         VALUES ($1, $2, $3, $4)`,
        [input.conversationId, position, row.role, row.content],
      );
      position += 1;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
