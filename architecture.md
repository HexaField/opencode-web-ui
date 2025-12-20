# Architecture

This document outlines the high-level architecture of the OpenCode Web UI.

## Overview

The application is a full-stack local development tool consisting of:

1.  **Frontend**: A Single Page Application (SPA) built with SolidJS and Tailwind CSS.
2.  **Backend**: An Express.js server that acts as a bridge between the frontend, the local file system, and the OpenCode SDK.

## Backend Architecture

The backend is an Express server running locally. It serves the static frontend assets and provides a REST API for system operations.

### Key Components

- **Express Server**: Handles HTTP requests and Server-Sent Events (SSE).
- **OpencodeManager**: Manages persistent connections to the OpenCode SDK for different workspaces. It spawns worker processes to isolate SDK instances per workspace.
- **Git Service**: Wraps local `git` CLI commands for version control operations.
- **Radicle Service**: Integrates with local Radicle capabilities for task management.

### Diagram

```mermaid
graph TD
    Client[Frontend Client] <-->|HTTP / SSE| Server[Express Server]

    subgraph "Backend Services"
        Server --> AuthMiddleware[Auth Middleware]
        AuthMiddleware --> API_Routes

        subgraph API_Routes
            SessionAPI[Session API]
            GitAPI[Git API]
            FS_API[File System API]
            TaskAPI[Task/Radicle API]
            AgentAPI[Agent API]
        end

        SessionAPI <--> OpencodeManager
        OpencodeManager -- Spawns --> Worker[Worker Process]
        Worker <--> SDK[OpenCode SDK]

        GitAPI <--> GitCLI[Local Git CLI]

        FS_API <--> FileSystem[Local File System]

        TaskAPI <--> RadicleService
        RadicleService <--> FileSystem

        AgentAPI <--> OpencodeManager
    end
```

## Frontend Architecture

The frontend is built with SolidJS, focusing on reactivity and performance. It uses Tailwind CSS for styling and Monaco Editor for code editing.

### Key Components

- **App**: The root component that manages the global workspace state (selected folder).
- **Workspace**: The main layout container for an active session. It manages navigation between different views (Chat, Changes, Files, Plan).
- **ChatInterface**: Handles real-time communication with the AI agent, displaying messages and tool calls.
- **PlanView**: Manages project tasks and planning (Kanban, DAG, List views).
- **FilesView**: Provides file exploration and code editing capabilities using Monaco Editor.
- **DiffView**: Visualizes git changes.
- **SessionList**: Displays and manages chat sessions.
- **AgentManager**: Allows configuration and selection of different AI agents.

### Diagram

```mermaid
graph TD
    App[App.tsx]

    App -->|No Folder Selected| FolderBrowser
    App -->|Folder Selected| Workspace

    subgraph "Workspace Layout"
        Workspace --> Navbar
        Workspace --> MainArea

        subgraph Navbar
            NavControls[View Switcher]
            SettingsBtn[Settings]
        end

        Workspace --> Sidebar

        Sidebar --> SessionList
        SessionList --> AgentManager

        MainArea --> ChatInterface
        MainArea --> FilesView
        MainArea --> PlanView
        MainArea --> DiffView

        subgraph "Plan Views"
            PlanView --> KanbanView
            PlanView --> ListView
            PlanView --> DAGView
        end

        subgraph "File Views"
            FilesView --> FileTree
            FilesView --> Editor[Monaco Editor]
        end
    end
```

## Data Flow

1.  **Initialization**: User selects a folder in `FolderBrowser`.
2.  **Connection**: Frontend calls `/api/connect` to initialize the `OpencodeManager` for that folder. The manager spawns a worker process that connects to the OpenCode SDK.
3.  **Interaction**:
    - **Chat**: Messages are sent to `/api/sessions/:id/prompt`. Updates are received via SSE at `/api/sessions/:id/events`.
    - **Files**: File reads/writes go through `/api/fs` or `/api/files` (which uses the SDK).
    - **Git**: Git operations are executed directly via the backend's `exec` wrappers.
    - **Agents**: Agent configurations are stored in `.opencode/agent/` within the workspace.
