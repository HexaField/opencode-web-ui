# Implementation Plan 5: Gateway & Scheduler

## 1. Overview

This plan establishes the control plane for the Personal Agent. It transforms the agent from a reactive system into a proactive one ("True Scheduler") and defines the abstractions for external communication (Gateway).

## 2. Dependencies

- **Pre-requisites**: `PLAN_01_CORE_ARCHITECTURE.md`, `PLAN_03_PACK_SYSTEM.md`.
- **Next Steps**: `PLAN_06_ADVANCED_SKILLS.md`.

## 3. High-Level Design

### 3.1 Gateway Core (Abstractions)

- **Goal**: Decouple the Agent Runtime from specific messaging platforms.
- `GatewayAdapter` Interface:
  - `start()`: data connection initialization.
  - `onMessage(handler: (msg: UserMessage) => Promise<AgentResponse>)`: Callback for incoming events.
  - `sendMessage(userId: string, content: string)`: Outbound communication.
- `MessageBroker`:
  - Singleton service that manages active adapters.
  - Normalizes messages into a `UserMessage` payload (content, source, userId).
  - Handles authentication (Whitelisting `userId` against `auth.json`).

### 3.2 True Scheduler (Cron)

- **Goal**: Allow the Agent to initiate actions based on time, not just user input.
- **Tech**: `node-cron`.
- `SchedulerService`:
  - Reads `USER/CONFIG/schedule.json`.
  - Registers cron jobs.
  - **Action**: Triggers a "System Event" on the `EventBus` (e.g., `SCHEDULE_TRIGGER`).
  - **Payload**: Contains instructions like "Run morning briefing task".

## 4. Implementation Steps

### Phase 1: Gateway Core

- [x] Create `server/src/services/gateway/types.ts` (Interfaces).
- [x] Create `server/src/services/gateway/gateway.manager.ts` (Registry).
- [x] Implement `MockAdapter` for CLI/Test usage.

### Phase 2: Scheduler

- [x] Install `node-cron`.
- [x] Create `server/src/services/scheduler/scheduler.service.ts`.
- [x] Connect `SCHEDULE_TRIGGER` event to `PersonalAgent.handleEvent()`.

## 5. Verification

- **Gateway**:
  - Instantiate `GatewayManager` with a `MockAdapter`.
  - Simulate an incoming message via code.
  - Verify Agent receives it and attempts to reply.
- **Scheduler**:
  - Register a cron job for `* * * * *` (every minute).
  - Verify `PersonalAgent` logs "Event received: SCHEDULE_TRIGGER".
