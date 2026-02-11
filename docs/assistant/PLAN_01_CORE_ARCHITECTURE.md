# Implementation Plan 1: Core Architecture Refactoring, Runtime & Identity

## 1. Overview

This phase introduces the **Agent Runtime** into the existing single-process Node.js application. Currently, the server just handles HTTP requests. We will refactor the entry point to initialize a background agent loop alongside the Express server, all within the same `server/src/index.ts` process. It also establishes the file system structure for User/System separation.

## 2. Refactoring Checklist

### Step 1: Configuration & Paths (New File)

**File**: `server/src/config.ts`

- **Goal**: Centralize path management and environment variables.
- **Tasks**:
  - Export `USER_DATA_ROOT` constant.
    - Logic: Use `process.env.OPENCODE_USER_DATA` if set, otherwise default to `~/.opencode/`.
  - Export `AppPaths` object containing:
    - `memory`: `${USER_DATA_ROOT}/MEMORY`
    - `packs`: `${USER_DATA_ROOT}/PACKS`
    - `config`: `${USER_DATA_ROOT}/CONFIG`

### Step 2: Initialization Service (New File)

**File**: `server/src/services/init.service.ts`

- **Goal**: Ensure the user data directory structure exists before the app starts.
- **Tasks**:
  - Create `InitService` class with a static `init()` method.
  - Implement logic to check if directories defined in `AppPaths` exist.
  - If not, create them using `fs.mkdir({ recursive: true })`.

### Step 4: Event Bus Infrastructure

**File**: `server/src/services/event-bus.ts`

- **Goal**: Create a central event emitter for the Agent to use for internal communication (hooks, logs, etc).
- **Tasks**:
  - Create a simple singleton or class-based `EventBus` extending Node's `EventEmitter` or a custom interface.
  - Define core event types: `AGENT_START`, `AGENT_TICK`, `AGENT_STOP`.

### Step 5: Agent Runtime Skeleton (New File)

**File**: `server/src/agent/PersonalAgent.ts`

- **Goal**: Create the background agent class that runs _within_ the main server process.
- **Tasks**:
  - Create `PersonalAgent` class.
  - Constructor should accept existing `OpencodeManager` (from `server.ts`).
  - **Inject/Initialize EventBus**.
  - Implement `start()`:
    - Log "Agent Runtime Started".
    - `EventBus.emit('AGENT_START')`.
    - Start a `setInterval` loop (e.g., every 5 seconds) for the "Tick".
  - Implement `stop()`: Cleans up intervals and saves state.
  - Implement `tick()`:
    - Log "Agent Tick" (for debug).
    - `EventBus.emit('AGENT_TICK')`.
    - (Future implementation will go here).

### Step 6: Update Entry Point (Modify Existing)

**File**: `server/src/index.ts`

- **Goal**: Initialize the Agent subsystem alongside the existing Express server startup.
- **Tasks**:
  - Refactor the existing startup logic into a `bootstrap()` function.
  - Before calling `app.listen()`:
    1.  Await `InitService.init()` to ensure file structure.
    2.  Instantiate `PersonalAgent`.
    3.  Call `agent.start()` to begin the background loop.
  - Keep the existing HTTP/HTTPS server setup logic.
  - Add graceful shutdown: When `SIGINT` is received, call `agent.stop()` before exiting.

## 3. Verification Steps

1.  Run `pnpm start:server`.
2.  **Check Files**: Verify that `~/.opencode/` (or your configured path) is created with subfolders `MEMORY`, `PACKS`, etc.
3.  **Check Logs**: Confirm you see both specific logs:
    - "Server running on https://..."
    - "Agent Runtime Started"
    - "Agent Tick" (repeating)
