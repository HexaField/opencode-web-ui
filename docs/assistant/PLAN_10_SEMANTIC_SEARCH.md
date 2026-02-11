# Implementation Plan 10: Unified Semantic Search (RAG)

## 1. Overview

This plan introduces **Retrieval Augmented Generation (RAG)** to the Personal AI Infrastructure. By embedding documentation, project summaries, and memory notes into a local vector store, the Agent gains the ability to "recall" granular details across the entire workspace registry and `TELOS` files without needing to open every file manually. This transforms the "Search" experience from filename matching to concept matching.

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_09_HOME_PAGE_UI.md` (Dashboard for search interface).
- **Libraries**:
  - `voy` or `chromadb` (Local vector storage).
  - `langchain` or `@xenova/transformers` (Embeddings).

## 3. High-Level Design

### 3.1 The Embedding Service

A decoupled service running within the main server process.

- **Scope**:
  - `USER/TELOS/*.md` (Mission, principles, context).
  - `USER/MEMORY/*.md` (Lessons learned).
  - `WorkspaceRegistry` (Project names, descriptions, and `README.md` content).
- **Strategy**: Use a lightweight, local-only embedding model (e.g., `all-MiniLM-L6-v2`) to keep data private and offline-capable.

### 3.2 Vector Store

A distinct folder `USER/MEMORY/vectors/`.

- Stores the index and metadata.
- **Portability**: The index is just a file, easily backed up or moved.

### 3.3 Search Tooling

- **Tool**: `search_knowledge_base`
- **Input**: Natural language query string.
- **Output**: Top 5 relevant text chunks with source file paths.

## 4. Implementation Steps

### Phase 1: Infrastructure

- [ ] Install embedding and vector store dependencies.
- [ ] Create `server/src/services/rag/vector.store.ts`.
- [ ] Implement `addDocument(id, text, metadata)` and `search(query, limit)`.

### Phase 2: Indexing Service

- [ ] Create `server/src/services/rag/indexer.service.ts`.
- [ ] Implement `indexWorkspace(path)`: Reads README and key meta-files.
- [ ] Implement `indexMemory()`: Reads contents of Memory/Telos directory.
- [ ] Add file watchers to auto-update index on changes.

### Phase 3: Agent Integration

- [ ] Create `search_knowledge_base` tool definition.
- [ ] Register tool in `PersonalAgent`.
- [ ] Update System Prompt to encourage using this tool for general questions.

### Phase 4: UI Integration

- [ ] Update `DashboardView` search bar to use `POST /api/search` (semantic) in addition to file search.
- [ ] Display "Reasoning" context matches in the UI.

## 5. Principles Alignment

- **User Centricity**: The agent remembers _what you meant_, not just exactly what you typed.
- **User/System Separation**: The vector index lives in `USER/MEMORY`, ensuring the "brain" is portable.
- **Privacy**: All embeddings run locally on the CPU; no data leaves the machine.
