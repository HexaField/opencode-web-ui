# Implementation Plan 13: Personal Home Workspace (The "Digital Home")

## 1. Overview

This plan enables the user to open the core **User Data Directory** (`~/.opencode`) as a fully-featured Workspace within the IDE. This transforms the directory from a hidden config folder into a "Personal Home" or "Digital Drive" where the user can:

1.  **Edit the Agent's Brain**: Directly modify `TELOS` files (`MISSION.md`, `GOALS.md`) to align the agent.
2.  **Manage Personal Files**: Store documents, photos, and notes (`DOCS/`, `PHOTOS/`) that are indexed by the agent but not tied to a specific coding project.
3.  **Develop Internals**: Create and test custom Packs directly in `PACKS/` using the IDE's tools.

It essentially creates a "Google Drive" alternative that is fully accessible to the Personal Agent.

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_09_HOME_PAGE_UI.md` (Dashboard).
  - `PLAN_08_GLOBAL_CONTEXT_AND_TEMPLATES.md` (Workspace Registry).

## 3. Conceptual Design

### 3.1 The "Home" Specialization

While technical workspaces (`/projects/my-app`) focus on code and git, the "Home Workspace" (`~/.opencode`) focuses on **Identity and Assets**.

- **Path**: `USER_DATA_ROOT` (e.g., `/Users/josh/.opencode`).
- **Structure**:
  - `TELOS/`: Identity files (Mission, Goals).
  - `MEMORY/`: Logs, Archives (Read-Only mostly).
  - `PACKS/`: Custom user tools.
  - `DOCS/`: General documents (New).
  - `MEDIA/`: Photos/Assets (New).
  - `CONFIG/`: JSON configs.

### 3.2 UI Integration

The Dashboard will feature a prominent **"Open Home"** action, distinct from the "Recent Projects" list.

## 4. Implementation Steps

### Phase 1: Backend Support

- [ ] **Path Exposure**: exposed `AppPaths.root` securely via the `InitService` or `WorkspaceService`.
- [ ] **Home Initialization**: Ensure standard folders (`DOCS`, `MEDIA`) exist in `~/.opencode` on startup.
- [ ] **Registry Logic**: Ensure the Home Workspace is always present in the `WorkspaceRegistry`, pinned to the top or treated specially.

### Phase 2: Frontend Dashboard Updates

- [ ] **Home Card**: Add a "Personal Home" card to `DashboardView.tsx`.
  - Icon: Home/Brain.
  - Action: Navigates to `/workspace?path=~/.opencode`.
- [ ] **Scaffold**: Ensure opening this path loads the standard IDE layout.

### Phase 3: "Drive" Features (Future)

- [ ] **Media Preview**: Add basic support for viewing images/PDFs in the Editor area (beyond code).
- [ ] **Drag & Drop**: Allow dragging files from OS into the File Tree (already supported by some Monaco/Browser implementations, verify).

## 5. Security Considerations

- **Self-Modification**: The user is editing the files the Agent reads to function. This is intended ("User Centricity"), but syntax errors in `jobs.json` or `tools.json` could break the agent.
  - _Mitigation_: The Agent's parsers must be robust and fail gracefully if user config is invalid.
- **Privacy**: This folder contains the most sensitive data.

## 6. User Stories

- **As a user**, I want to open my "Home" workspace to quickly update my `GOALS.md` for the week.
- **As a user**, I want to drag a PDF into `DOCS/reference/` so I can ask the Agent questions about it later (via RAG).
- **As a user**, I want to write a quick script in `PACKS/my-utils/` to automate a personal task.
