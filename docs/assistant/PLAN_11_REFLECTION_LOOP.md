# Implementation Plan 11: The "Reflection" Loop (Auto-Learning)

## 1. Overview

Currently, the `AgentMemoryWidget` displays lessons, but adding them requires manual intervention or specific tool calls during a session. This plan implements the **"Outer Loop"**, an automated process where the agent reflects on past sessions to extract facts, preferences, and improvements, writing them permanently to memory. This turns the system into a self-improving OS.

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_02_MEMORY_LAYER.md` (Memory structure).
  - `PLAN_09_HOME_PAGE_UI.md` (To display the results).

## 3. High-Level Design

### 3.1 The Analyzer Agent

A specialized Sub-Agent (using the existing `opencode` infrastructure) tasked with "Reflection".

- **Trigger**:
  - End of a Session (User clicks "Finish" or "Close").
  - Periodic "Nightly" job.
- **Input**: Full conversation history of the session.
- **Output**: JSON object containing:
  - `facts`: New factual knowledge (e.g., "Project X uses Port 3000").
  - `preferences`: User likes/dislikes (e.g., "User prefers simple error handling").
  - `critique`: Self-correction for the agent.

### 3.2 Memory Consolidation

- **Mechanism**: The system appends these valid extractions to `USER/MEMORY/LEARNED.md` or a structured `knowledge.json`.
- **Deduplication**: Simple semantic check to avoid repeating "User likes TypeScript" 50 times.

### 3.3 "Config Drift"

If the user repeatedly overrides a setting (e.g., "Use 2 spaces for indentation"), the Analyzer proposes a patch to `.pai/config.json` or the project's linter config.

## 4. Implementation Steps

### Phase 1: Analyzer Service

- [x] Create `server/src/services/reflection/analyzer.service.ts`.
- [x] Define the `ReflectionAgent` prompt (focused on extraction, not conversation).
- [x] Implement `analyzeSession(sessionId)` method.

### Phase 2: Integration

- [x] Add hook in `SessionsService`: `onSessionArchived` trigger `analyzeSession`.
- [x] Create `server/src/services/reflection/consolidator.ts` to merge insights into `LEARNED.md` (Implemented via `LearningService` integration).
- [x] Add `ReflectionListener` and Event Bus events.

### Phase 3: UI Feedback ✅

- [x] Add a "Reflections" tab to the Dashboard (Implemented via `AgentMemoryWidget`).
- [x] Show "New Insights" notifications when the analyzer finds something.
- [x] Allow User to "Reject" or "Edit" a learned lesson.

## 5. Principles Alignment

- **Persistent Identity**: The assistant becomes more "You" over time by observing your interactions.
- **Automated Intelligence**: You shouldn't have to teach the agent the same thing twice.
