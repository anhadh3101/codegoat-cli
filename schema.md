# Database schema

Neon Postgres schema for persisting CLI chat sessions.

**Project:** `restless-fog-43676332` (see `PRIMARY_DB_*` in `.env`)  
**Database:** `neondb`  
**Branch:** `main`

Auth lives in Auth0. Neon stores sessions and messages only. Rows are scoped by Auth0 `sub` in `session.user_id`.

## Tables

### `session`

One row per chat session. Holds the full agent state needed to resume a session.

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `user_id` | `text` | no | — | Auth0 `sub` |
| `title` | `text` | yes | — | Optional display title (e.g. first user message) |
| `cwd` | `text` | yes | — | Working directory when the session started |
| `model` | `text` | no | — | Model id (e.g. `claude-sonnet-4-5`) |
| `agent_messages` | `jsonb` | no | `'[]'` | Full `AgentState.messages` (`Anthropic.MessageParam[]`) |
| `created_at` | `timestamptz` | no | `now()` | When the session was created |
| `updated_at` | `timestamptz` | no | `now()` | Last turn; bump after each completed agent turn |

**Indexes**

- `session_pkey` — primary key on `id`
- `session_user_updated_idx` — `(user_id, updated_at DESC)` for listing a user's chats

### `messages`

One row per UI transcript line. Used to render the chat; not the source of truth for agent resume.

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `session_id` | `uuid` | no | — | FK → `session(id)` ON DELETE CASCADE |
| `position` | `integer` | no | — | Sort order within the session (0-based or 1-based; be consistent) |
| `role` | `text` | no | — | `user`, `assistant`, `error`, or `info` |
| `content` | `text` | no | — | Display text |
| `created_at` | `timestamptz` | no | `now()` | When the message was written |

**Constraints**

- `messages_role_check` — `role IN ('user', 'assistant', 'error', 'info')`
- `messages_session_id_position_key` — unique `(session_id, position)`

**Indexes**

- `messages_pkey` — primary key on `id`
- `messages_session_position_idx` — `(session_id, position)` for ordered fetch

## DDL

```sql
CREATE TABLE session (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL,
  title          text,
  cwd            text,
  model          text NOT NULL,
  agent_messages jsonb NOT NULL DEFAULT '[]',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_user_updated_idx
  ON session (user_id, updated_at DESC);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'error', 'info')),
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, position)
);

CREATE INDEX messages_session_position_idx
  ON messages (session_id, position);
```

## Usage

**List sessions for a user**

```sql
SELECT id, title, model, updated_at
FROM session
WHERE user_id = $1
ORDER BY updated_at DESC;
```

**Load a session for resume**

```sql
SELECT model, cwd, agent_messages
FROM session
WHERE id = $1 AND user_id = $2;
```

**Load display transcript**

```sql
SELECT role, content
FROM messages
WHERE session_id = $1
ORDER BY position;
```

**Persist after a turn**

```sql
UPDATE session
SET model = $2, agent_messages = $3::jsonb, updated_at = now()
WHERE id = $1 AND user_id = $4;
```

Insert new `messages` rows with `position = (SELECT COALESCE(MAX(position), -1) + 1 FROM messages WHERE session_id = $1)`.

## Mapping to app types

| App | Database |
| --- | --- |
| `AgentState.messages` | `session.agent_messages` |
| `AgentState.model` | `session.model` |
| `process.cwd()` at session start | `session.cwd` |
| Auth0 `sub` | `session.user_id` |
| `TranscriptItem` (`user` / `assistant` / `error` / `info`) | `messages.role` + `messages.content` |

Banner rows are UI-only and are not stored in `messages`.

## Migrations

Applied migrations live in `migrations/`.

| Migration | Description | Status |
| --- | --- | --- |
| `001_rename_conversations_to_session.sql` | Renames `conversations` → `session`, `messages.conversation_id` → `session_id`, and related indexes | Applied |
