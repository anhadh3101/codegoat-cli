# Database schema

Neon Postgres schema for persisting CLI chat sessions.

**Project:** `restless-fog-43676332` (see `PRIMARY_DB_*` in `.env`)  
**Database:** `neondb`  
**Branch:** `main`

Auth lives in Auth0. Neon stores conversations and messages only. Rows are scoped by Auth0 `sub` in `conversations.user_id`.

## Tables

### `conversations`

One row per chat session. Holds the full agent state needed to resume a session.

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `user_id` | `text` | no | — | Auth0 `sub` |
| `title` | `text` | yes | — | Optional display title (e.g. first user message) |
| `cwd` | `text` | yes | — | Working directory when the session started |
| `model` | `text` | no | — | Model id (e.g. `claude-sonnet-4-5`) |
| `agent_messages` | `jsonb` | no | `'[]'` | Full `AgentState.messages` (`Anthropic.MessageParam[]`) |
| `created_at` | `timestamptz` | no | `now()` | When the conversation was created |
| `updated_at` | `timestamptz` | no | `now()` | Last turn; bump after each completed agent turn |

**Indexes**

- `conversations_pkey` — primary key on `id`
- `conversations_user_updated_idx` — `(user_id, updated_at DESC)` for listing a user's chats

### `messages`

One row per UI transcript line. Used to render the chat; not the source of truth for agent resume.

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `conversation_id` | `uuid` | no | — | FK → `conversations(id)` ON DELETE CASCADE |
| `position` | `integer` | no | — | Sort order within the conversation (0-based or 1-based; be consistent) |
| `role` | `text` | no | — | `user`, `assistant`, `error`, or `info` |
| `content` | `text` | no | — | Display text |
| `created_at` | `timestamptz` | no | `now()` | When the message was written |

**Constraints**

- `messages_role_check` — `role IN ('user', 'assistant', 'error', 'info')`
- `messages_conversation_id_position_key` — unique `(conversation_id, position)`

**Indexes**

- `messages_pkey` — primary key on `id`
- `messages_conversation_position_idx` — `(conversation_id, position)` for ordered fetch

## DDL

```sql
CREATE TABLE conversations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL,
  title          text,
  cwd            text,
  model          text NOT NULL,
  agent_messages jsonb NOT NULL DEFAULT '[]',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversations_user_updated_idx
  ON conversations (user_id, updated_at DESC);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'error', 'info')),
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, position)
);

CREATE INDEX messages_conversation_position_idx
  ON messages (conversation_id, position);
```

## Usage

**List conversations for a user**

```sql
SELECT id, title, model, updated_at
FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC;
```

**Load a conversation for resume**

```sql
SELECT model, cwd, agent_messages
FROM conversations
WHERE id = $1 AND user_id = $2;
```

**Load display transcript**

```sql
SELECT role, content
FROM messages
WHERE conversation_id = $1
ORDER BY position;
```

**Persist after a turn**

```sql
UPDATE conversations
SET model = $2, agent_messages = $3::jsonb, updated_at = now()
WHERE id = $1 AND user_id = $4;
```

Insert new `messages` rows with `position = (SELECT COALESCE(MAX(position), -1) + 1 FROM messages WHERE conversation_id = $1)`.

## Mapping to app types

| App | Database |
| --- | --- |
| `AgentState.messages` | `conversations.agent_messages` |
| `AgentState.model` | `conversations.model` |
| `process.cwd()` at session start | `conversations.cwd` |
| Auth0 `sub` | `conversations.user_id` |
| `TranscriptItem` (`user` / `assistant` / `error` / `info`) | `messages.role` + `messages.content` |

Banner rows are UI-only and are not stored in `messages`.
