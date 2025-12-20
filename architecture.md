# Architecture

## Front End Architecture

The front end is built using **SolidJS** and communicates with the backend via REST APIs. It is organized into a modular structure where views and components are distinct.

```mermaid
graph TD
    subgraph Components
        App[App.tsx]
        Workspace[Workspace.tsx]
        SessionList[SessionList.tsx]
        ChatInterface[ChatInterface.tsx]
        DiffView[DiffView.tsx]
        FilesView[FilesView.tsx]
        PlanView[PlanView.tsx]
        SettingsModal[SettingsModal.tsx]
        AgentManager[AgentManager.tsx]

        subgraph Views
            ChatView[Chat View]
            ChangesView[Changes View]
            FilesBrowserView[Files View]
            PlanBoardView[Plan View]
        end
    end

    App -->|Manages Folder State| Workspace
    Workspace -->|Switch Views| ChatView
    Workspace -->|Switch Views| ChangesView
    Workspace -->|Switch Views| FilesBrowserView
    Workspace -->|Switch Views| PlanBoardView
    Workspace -->|Modals| SettingsModal
    SessionList -->|Modals| AgentManager

    ChatView --> SessionList
    ChatView --> ChatInterface
    ChangesView --> DiffView
    FilesBrowserView --> FilesView
    PlanBoardView --> PlanView
```

## Back End Architecture

The back end is an **Express** server that acts as a bridge between the frontend and local system services (Git, File System, Opencode SDK, Radicle).

```mermaid
graph TD
    subgraph Server
        Express[Express App]
        GitModule[git.ts]
        OpencodeModule[opencode.ts]
        RadicleModule[radicle.ts]
        FSModule[Node fs/promises]

        subgraph APIs
            SessionAPI["/api/sessions"]
            GitAPI["/api/git/*"]
            FSAPI["/api/fs/*"]
            FilesAPI["/api/files/*"]
            TasksAPI["/api/tasks"]
            AgentsAPI["/api/agents"]
        end
    end

    Express --> SessionAPI
    Express --> GitAPI
    Express --> FSAPI
    Express --> FilesAPI
    Express --> TasksAPI
    Express --> AgentsAPI

    SessionAPI -->|Manage Sessions| OpencodeModule
    GitAPI -->|Git Operations| GitModule
    FSAPI -->|File System Ops| FSModule
    FilesAPI -->|File Reads/Status| OpencodeModule
    FilesAPI -->|Diffs| GitModule
    TasksAPI -->|Manage Tasks| RadicleModule
    AgentsAPI -->|Manage Agents| OpencodeModule
```
