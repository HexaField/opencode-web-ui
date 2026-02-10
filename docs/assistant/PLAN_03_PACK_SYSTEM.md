# Implementation Plan 3: Pack & Skill System

## 1. Overview

This plan implements the "Hands" of the agent using the "Pack" architecture. It follows the philosophy of "Determinism First" (Code > Prompts). This system allows dynamic loading of capabilities from the `USER/PACKS/` directory.

## 2. Dependencies

- **Pre-requisites**: `PLAN_01_CORE_ARCHITECTURE.md`.
- **Next Steps**: `PLAN_04_HOOK_SYSTEM.md`.

## 3. High-Level Design

### 3.1 Pack Structure

- A Pack is a folder containing:
  - `manifest.json`: Metadata (name, version, permissions).
  - `index.ts`: The entry point exporting functions.
  - `tools.json`: `AgentSkills` schema definitions for the LLM.

### 3.2 Pack Loader

- A service that scans `USER/PACKS/` and `SYSTEM/PACKS/`.
- Dynamically imports the modules.
- Validates schemas.
- Registers tools into the `PersonalAgent`'s tool registry.

### 3.3 Core Standard Packs

- Implement the initial set of essential packs:
  - `pai-fs-pack`: Safe file system operations.
  - `pai-shell-pack`: Executing shell commands (with strict allow-listing initially).

## 4. Implementation Steps

### Phase 1: Schema & Types

- [x] Define `PackManifest` and `ToolDefinition` interfaces in `server/src/types/packs.ts`.
- [x] Create `server/src/services/packs/pack-loader.ts`.

### Phase 2: The Loader Implementation

- [x] Implement `loadPacks()`:
  - Glob search for `manifest.json`.
  - Dynamic `import()`.
  - Error handling for broken packs.
- [x] Create `server/src/services/tools/tool-registry.ts` to map tool names to executable functions.

### Phase 3: Core Packs

- [x] Create `server/src/packs/core/fs/`:
  - `read_file`, `write_file`, `list_dir`.
- [x] Create `server/src/packs/core/shell/`:
  - `run_command` (Refactor existing `git` service logic if applicable).

### Phase 4: Integration

- [x] Connect `ToolRegistry` to `PersonalAgent`.
- [x] Ensure the Agent can "see" the tools in its system prompt/function definitions.

## 5. Files to Create/Edit

- `server/src/types/packs.ts`
- `server/src/services/packs/pack-loader.ts`
- `server/src/services/tools/tool-registry.ts`
- `server/src/packs/core/fs/*`
- `server/src/packs/core/shell/*`

## 6. Verification

- Create a dummy pack in `USER_DATA_ROOT/PACKS/test-pack`.
- Restart server.
- Verify logs show "Loaded pack: test-pack".
- Verify Agent can list the tool `test_tool` in its capabilities.
