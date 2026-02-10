# Implementation Plan 12: Task Scheduling (Cron Packs)

## 1. Overview

A Personal Operating System should work asynchronously. This plan enables specific Agent Workflows or Scripts to run on a schedule. This moves the system from "Reactive" (waiting for user input) to "Proactive" (performing maintenance and data gathering automatically).

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_05_GATEWAY_SCHEDULER.md` (Scheduler scaffold).
  - `PLAN_13_REMOTE_GATEWAYS.md` (Optional: to send notifications of completion).

## 3. High-Level Design

### 3.1 The Job Registry

A JSON-based configuration file in `USER/config/jobs.json`.

```json
[
  {
    "name": "Daily Standup Summary",
    "cron": "0 9 * * 1-5",
    "action": "agent_workflow",
    "payload": {
      "prompt": "Summarize git commits from the last 24 hours.",
      "output": "telegram"
    }
  },
  {
    "name": "Clean Temp Files",
    "cron": "0 0 * * 0",
    "action": "script",
    "payload": {
      "path": "scripts/clean_tmp.ts"
    }
  }
]
```

### 3.2 Execution Engine

- **Service**: `SchedulerService` (enhanced).
- **Logic**:
  1. Load jobs on startup.
  2. Use `node-cron` to schedule triggers.
  3. On trigger, spawn a generic `WorkerAgent` or execute a TypeScript script.
  4. Log results to `USER/logs/scheduler.log`.

### 3.3 Notification

- If a job produces output (text), send it to the configured Gateway (e.g., Telegram message: "Daily Standup Summary: ...").

## 4. Implementation Steps

### Phase 1: Configuration & Loading

- [x] Define `Job` schema.
- [x] Implement `SchedulerService.loadJobs()`.
- [x] Watch `jobs.json` for changes to hot-reload schedules.

### Phase 2: Agent Runner

- [x] Create `HeadlessAgentRunner` (Implemented via `JobExecutor` & Event Bus).
- [x] Ability to execute a prompt without a UI session.
- [x] Capture output.

### Phase 3: Script Runner

- [x] Securely execute local scripts (e.g., `tsx` or compiled JS) defined in the User's `scripts` folder.

### Phase 4: Reporting

- [x] Integrate with `Gateway` to push results (Implemented via `JOB_COMPLETED` event emission).

## 5. Principles Alignment

- **Determinism First**: Prefer simple scripts for maintenance tasks; use Agents for fuzzy summarization tasks.
- **Modularity**: Jobs are defined in user-space config, keeping the system core generic.
