# Implementation Plan 4: Hook & Security System

## 1. Overview

This plan implements the "Immune System" of the Personal OS. The Hook System intercepts agent actions (lifecycle events) to perform security checks, logging, and automated side-effects. This is critical for running a local agent safely.

## 2. Dependencies

- **Pre-requisites**: `PLAN_03_PACK_SYSTEM.md` (Need Tools to intercept).
- **Next Steps**: `PLAN_05_GATEWAY_SCHEDULER.md`.

## 3. High-Level Design

### 3.1 Event System (Refinement)

- The `PersonalEventBus` was established in Plan 1.
- In this phase, we add specific _Hook Listeners_ to that bus.
- Events we care about:
  - `TOOL_PRE_EXECUTE` (Cancellable)
  - `TOOL_POST_EXECUTE`

### 3.2 Security Hooks

- Implement a default Security Hook that listens to `TOOL_PRE_EXECUTE`.
- Logic: "If tool is `run_shell_command`, check command against User whitelist/blacklist."
- If check fails, throw error (preventing execution).

### 3.3 Automation Hooks

- Allow Packs to register hooks.
- Example: `pai-git-pack` could listen to `SESSION_START` to run `git fetch` automatically.

## 4. Implementation Steps

### Phase 1: Security Implementation

- [x] Create `server/src/services/security/security.hook.ts`.
- [x] Implement `DangerousCommandBlocker`.
- [x] Add `confirmation_required` flag logic for sensitive tools.

### Phase 2: Integration with Runtime

- [x] Wrap `ToolRegistry.execute()` with Hook triggers.
  - Emit `TOOL_PRE_EXECUTE` -> Await all listeners. If any throw, abort.
  - Execute Tool.
  - Emit `TOOL_POST_EXECUTE`.

## 5. Files to Create/Edit

- `server/src/services/security/security.hook.ts`
- `server/src/services/tools/tool-registry.ts` (Modify execution flow)

## 6. Verification

- Create a test hook that blocks `rm -rf`.
- Ask Agent to run `rm -rf /`.
- Verify the tool is blocked and Agent receives "Action Denied by Security Policy".
