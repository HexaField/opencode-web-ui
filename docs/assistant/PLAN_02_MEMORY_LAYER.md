# Implementation Plan 2: Memory Layer & Continuous Learning

## 1. Overview

This plan implements the "Brain" of the agent: the persistent memory system and the "Outer Loop" logic that enables continuous learning. This moves the agent from a stateless bot to a stateful assistant.

## 2. Dependencies

- **Pre-requisites**: `PLAN_01_CORE_ARCHITECTURE.md` (Need Agent Runtime & Paths).
- **Next Steps**: `PLAN_03_PACK_SYSTEM.md`.

## 3. High-Level Design

### 3.1 SQLite & FTS5 Knowledge Base

- Use `better-sqlite3` for a local database in `USER/MEMORY/knowledge.db`.
- Enable FTS5 (Full-Text Search) for fast retrieval of past conversations and documents.

### 3.2 Session Logging (Warm Memory)

- Update code to serialize conversation threads into `USER/MEMORY/sessions/YYYY-MM-DD-session-id.jsonl`.
- JSONL format allows reliable appending without corruption risks.

### 3.4 Tiered Memory Architecture (Hot/Warm/Cold)

- **Hot Memory**: The current `AgentContext` object in RAM. Contains TELOS, current plan, and short-term chat window.
- **Warm Memory**: File-based session logs (`sessions/`). Accessible by recent indexing.
- **Cold Memory**: The SQLite/FTS5 database and `knowledge/` Markdown archive. Used for deep retrieval ("What did I work on last November?").

## 4. Implementation Steps

### Phase 1: Database Setup

- [x] Install `better-sqlite3` and `zod`.
- [x] Create `server/src/services/memory/db.ts` to initialize SQLite connection.
- [x] Create generic "embedded document" table schema with FTS5 index.

### Phase 2: Session Manager

- [x] Create `server/src/services/memory/session-manager.ts`.
- [x] Implement `appendMessage(sessionId, message)` using simple FS operations (JSONL).
- [x] Implement `getRecentSessions()` for context retrieval.

### Phase 3: Continuous Learning Logic

- [x] Create `server/src/services/memory/learning.service.ts`.
- [x] Implement `recordFailure(context, error)` -> writes to `failures.md`.
- [x] Implement `recordLesson(trigger, lesson)` -> writes to `LEARNED.md`.
- [x] Modify `PersonalAgent.ts` to include contents of `LEARNED.md` in the system prompt.

## 5. Files to Create/Edit

- `server/src/services/memory/db.ts`
- `server/src/services/memory/session-manager.ts`
- `server/src/services/memory/learning.service.ts`
- `server/src/agent/PersonalAgent.ts` (Integration)

## 6. Verification

- Start server.
- Interact with the agent (mocked).
- Check `USER/MEMORY/knowledge.db` exists.
- Check `USER/MEMORY/sessions/` contains logs.
- Manually trigger a "learning" event and verify `LEARNED.md` is updated.
