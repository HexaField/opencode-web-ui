# Plan 14: Memory Architecture (PAI & OpenClaw Alignment)

## 1. Executive Summary

This plan re-architects the OpenCode memory system to align with the **OpenClaw/MoltBot** reference model while strictly adhering to the **Personal AI Infrastructure (PAI) Principles**.

The goal is to transition from a fragmented "Session" model to a **Two-Tier Memory System** (Ephemeral vs. Durable) that serves as the foundation of the user's **Persistent Identity**.

## 2. Alignment with Principles

This architecture is explicitly designed to satisfy `PRINCIPLES.md`:

| Principle | Implementation in Memory Architecture |
| :-- | :-- |
| **User/System Separation** | **Strict Isolation**: The "Engine" (`server/src`) is the System. The "Memory" (`~/.opencode/MEMORY/`) is the User. We treat the User folder as "Sacred"—the system reads/appends but never destroys user decisions ensuring portability. |
| **User Centricity** | The memory structure is human-readable (Markdown). It is designed for _you_ to read and edit, not just for the machine. Your `MEMORY.md` defines the Assistant's `TELOS`. |
| **Determinism First** | **Code > Agents**: Retrieval is handled by a deterministic Hybrid Search algorithm (TypeScript), not by asking an LLM to "find relevant info." We use code to fetch facts, then LLMs to synthesize them. |
| **Persistent Identity** | The system enables "Warm Storage" (Daily Journals) and "Cold Storage" (Knowledge Base), ensuring the Assistant learns and maintains context over weeks/years, not just single sessions. |

## 3. Directory Structure: The User Space

We establish `~/.opencode/MEMORY` as the dedicated **USER** partition.

```text
~/.opencode/MEMORY/              # [USER SPACE - Portable & Sacred]
├── MEMORY.md                    # [Durable] Core Identity, Goals (TELOS), & Facts.
├── journals/                    # [Warm Storage] The "Stream of Consciousness".
│   ├── 2026-02-10.md            # Daily scratchpad for thoughts, plans, & logs.
│   └── 2026-02-09.md
├── history/                     # [Archive] Full raw transcripts (if needed).
│   └── 2026-02-10-task-1.md
└── knowledge.db                 # [Index] A derivative index (cache) of the MD files.
```

**Workflow Rules:**

1.  **Read-Only System**: The `SYSTEM` (codebase) updates `knowledge.db` automatically but treats `.md` files as the Source of Truth.
2.  **Agent Edits**: The Agent can append to `journals/` or propose updates to `MEMORY.md` (active learning), but `MEMORY.md` changes should be explicit significant events (the "Outer Loop").

## 4. Technical Implementation (Findings & Determinism)

We reject complex native dependencies (`sqlite-vec`) in favor of a portable, deterministic TypeScript implementation.

### 4.1 Tech Stack

- **Database**: `better-sqlite3` (Existing, robust).
- **Search Logic**: **Hybrid Fusion** (Deterministic Algorithm).
  - 30% Keyword Match (FTS5).
  - 70% Semantic Match (Cosine Similarity).
- **Vector Operations**: Implemented in pure JavaScript (using `Buffer` / `Float32Array`).
  - _Finding_: For personal knowledge bases (< 100k chunks), brute-force JS cosine similarity is sufficiently fast (< 50ms) and avoids the fragility of C++ vector extensions.

### 4.2 Database Schema (`knowledge.db`)

This schema resides in `server/src/services/memory/db.ts` but persists data to the User folder.

```sql
-- files: Tracks the Source of Truth (Markdown files)
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL, -- Relative to MEMORY root
    last_modified INTEGER NOT NULL,
    hash TEXT NOT NULL
);

-- chunks: The atomic units of knowledge
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    file_id INTEGER,
    content TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    embedding BLOB, -- Serialized Float32Array
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- chunks_fts: FTS5 Virtual Table for BM25 Search
CREATE VIRTUAL TABLE chunks_fts USING fts5(content, content='chunks', content_rowid='id');
```

## 5. The "Outer Loop" (Learning Cycle)

To satisfy the **Persistent Identity** principle, we implement a "Pre-compaction Flush" cycle (The "Brain Dump").

1.  **Monitor**: `AgentLoop` tracks token usage or "Conversation Turns".
2.  **Trigger**: When `Turns > Threshold`, the System injects a directive:
    > "Memory Pressure High. Review the current session. Extract important facts to 'MEMORY.md' or 'journals/today.md'. Discard trivial dialogue."
3.  **Action**: The Agent uses `write_file` / `append_file`.
4.  **Result**: The Agent actively curates its own long-term memory, evolving `MEMORY.md` into a rich profile of the User's needs.

## 6. Implementation Roadmap

### Phase 1: Storage Layer (Deterministic Foundation)

- [x] Refactor `db.ts` to support the `files` / `chunks` schema.
- [x] Implement `IndexerService` to watch `~/.opencode/MEMORY/**/*.md`.
  - One-way sync: Markdown -> SQLite.

### Phase 2: Retrieval Logic (Code > Agents)

- [x] Implement `HybridSearcher` class.
  - `search(query)`: Executes standard FTS5 query AND vector scan.
  - Fusion logic implemented in pure TypeScript.
- [x] Replace current `search_knowledge_base` tool with this engine.

### Phase 3: The Assistant's Mind (Context Loading)

- [x] Update `PersonalAgent` structure.
  - **System Prompt**: `MEMORY.md` + Principles.
  - **Context Window**: `journals/{yesterday}.md` + `journals/{today}.md` + Recent Messages.
- [x] Enables the Assistant to "wake up" knowing what happened yesterday.
