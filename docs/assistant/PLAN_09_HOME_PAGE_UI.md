# Implementation Plan 9: Global Home Page UI

## 1. Overview

This plan transforms the initial experience of `opencode-web-ui`. Instead of landing on a blank editor or a simple file picker, users will be greeted by a **Global Dashboard**. This dashboard serves as the "Control Center" for the Personal AI, allowing navigation between projects, creation of new ones via templates, and interaction with the Global Agent context.

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_08_GLOBAL_CONTEXT_AND_TEMPLATES.md` (Backend support for Workspaces/Templates).
- **Next Steps**: Implementation of the UI components.

## 3. High-Level Design

### 3.1 The "Landing" State

Currently, the App likely defaults to a file picker or a specific workspace.

- **New Flow**:
  - If URL has `?folder=/path`, load **Workspace Mode**.
  - If URL is clean, load **Home/Dashboard Mode**.

### 3.2 UI Layout (Dashboard)

A grid-based layout centering on the User's Identity (TELOS) and Productivity.

**Sections:**

1.  **Header**: Global Agent Status (Thinking/Idle), Notifications.
2.  **Hero/Chat**: A "Global Chat" always available. Ask general questions ("What's on my schedule?", "Search my knowledge base") without opening a specific folder.
3.  **Recent Workspaces**: A list of cards showing recently opened projects (name, path, relative time, tags).
4.  **Start Something New**: A prominent "Create New" area listing available templates (`monorepo`, `react`, etc.) to one-click scaffold a new repo.
5.  **Agent Memory**: A widget showing "Lessons Learned" or "Current Mission" from `TELOS`.

## 4. Backend API Requirements

We need to expose the services created in Plan 8 to the frontend.

- **GET** `/api/workspaces`: JSON list of recent projects from `WorkspaceRegistry`.
- **GET** `/api/templates`: JSON list of available templates.
- **POST** `/api/workspaces/scaffold`: Body `{ template, path, name }`. Triggers `scaffold_project` tool.

## 5. Frontend Components

### 5.1 `DashboardView.tsx`

The main container for the Home state.

### 5.2 `ProjectCard.tsx`

Displays a project's metadata.

- **Actions**: "Open" (navigates to workspace), "Copy Path".

### 5.3 `TemplatePicker.tsx`

A visual selector for templates.

- Displays template name and description.
- Input for "New Project Path/Name".

### 5.4 `GlobalChatWidget.tsx`

A simplified version of the main `ChatInterface`.

- Context: Connects to the Agent with `cwd = USER_HOME`.
- Purpose: Meta-tasks, search, planning next steps.

## 6. Implementation Steps

### Phase 1: API Layer

- [x] Create `server/src/api/workspaces.ts` (Note: Implemented as `server/src/services/workspaces/workspaces.service.ts`).
- [x] Implement endpoints:
  - `GET /` (List recent)
  - `GET /templates` (List templates)
  - `POST /create` (Scaffold)
- [x] Register router in `server.ts`.

### Phase 2: Frontend Data Layer

- [x] Add API client methods in `src/api/workspaces.ts` (new file).
  - `fetchRecentWorkspaces()`
  - `fetchTemplates()`
  - `createProject(payload)`

### Phase 3: Dashboard UI Construction

- [x] Create `src/components/Dashboard/`.
- [x] Implement `RecentProjects.tsx`.
- [x] Implement `NewProjectWizard.tsx`.
- [x] Implement `DashboardView.tsx`.
- [x] Update `App.tsx`:
  - Check URL params on mount.
  - Render `<DashboardView />` if no folder selected.

### Phase 4: Integration

- [x] Connect "Create Project" flow:
  1.  User selects "Monorepo".
  2.  Enters path `~/Dev/my-new-app`.
  3.  Frontend calls API.
  4.  Backend runs scaffolding.
  5.  Frontend automatically navigates to `?folder=~/Dev/my-new-app`.

### Phase 5: Dashboard Enhancements (Missing Features)

- [x] Implement `GlobalChatWidget.tsx` (Persistant context-free chat).
- [x] Implement `AgentStatusHeader.tsx` (Showing Thinking/Idle state).
- [x] Implement `AgentMemoryWidget.tsx` (Displaying lessons learned).
- [x] Refactor `RecentProjects.tsx` to use a dedicated `ProjectCard.tsx` component.
- [x] Update `DashboardView.tsx` to include these new widgets.

## 7. Principles Alignment

- **User Centricity**: The Dashboard puts user goals (`TELOS`) and recent context front-and-center, rather than just a file tree.
- **Low Friction**: Creating a new project becomes a 1-click determinisic action using the Template system.
