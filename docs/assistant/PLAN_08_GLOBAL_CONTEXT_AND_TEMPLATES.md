# Implementation Plan 8: Global Context & Composable Templates

## 1. Overview

This plan addresses the integration of the PAI (Personal AI) backend into the multi-workspace IDE environment (`opencode-web-ui`). It introduces a **Global Memory Context** that persists across different project sessions and a **Composable Template System** for rapidly spinning up new experiments with pre-configured dependencies.

The goal is to move from "One Agent per Folder" to "One Global Assistant visiting multiple Folders".

## 2. Dependencies

- **Pre-requisites**:
  - `PLAN_01_CORE_ARCHITECTURE.md` (Agent Runtime).
  - `PLAN_02_MEMORY_LAYER.md` (Memory/TELOS).
  - `PLAN_03_PACK_SYSTEM.md` (Packs).
- **Next Steps**: Implementation of `pai-scaffold-pack` and Global Context Service.

## 3. Conceptual Architecture

### 3.1 The "User-Global" Context vs. "Workspace-Local" Context

Currently, the Agent can be perceived as isolated to the current open folder. We will formalize a hierarchy:

1.  **Global Context (`~/.opencode/`)**:
    - **Identity**: `TELOS` (Mission, Goals).
    - **Knowledge**: `knowledge.db` (Long-term facts).
    - **Skills**: Global Packs (Shell, Git, etc.).
    - **Registry**: `workspaces.json` (List of known projects).

2.  **Local Context (`/path/to/project/`)**:
    - **Task**: Current open files, git status.
    - **Project Config**: `.pai/config.json` (Project-specific rules).
    - **Local Memory**: Project-specific notes/scratchpad.

The Agent Runtime will essentially "mount" the Local Context on top of the Global Context when a workspace is opened.

### 3.2 Composable Template System

A structured way to define "Project Stacks" (Templates). Instead of just git cloning, a template defines:

- **Base Boilerplate**: (e.g., specific git repo or built-in scaffold).
- **PAI Configuration**: Pre-set `PROJECT_TELOS.md` or `.pai/config.json` tailored for that stack.
- **Dependencies**: Explicit list of libraries to install immediately.
- **Post-Install Scripts**: Commands to run after instantiation.

## 4. High-Level Design

### 4.1 Global Workspace Manager

- **File**: `USER/MEMORY/workspaces.json`
- **Service**: `WorkspaceRegistryService`.
- **Function**:
  - Tracks every project the user opens.
  - Stores metadata: `lastOpened`, `tags` (e.g., "experiment", "production"), `techStack` (detected from package.json).
  - Allows the Agent to answer: "What was I working on last week?" or "Where is that React experiment?"

### 4.2 Template Engine (`pai-scaffold-pack`)

- **Location**: `USER/TEMPLATES/{template_id}/` or built-in system templates.
- **Structure**:
  - `manifest.json`: Template metadata.
  - `payload/`: The file structure to copy.
  - `instructions.md`: Special context for the Agent when working in this stack.
- **Tool**: `scaffold_project(template_name, target_path, options)`.

### 4.3 Context Injection Mechanism

- When the IDE connects to the Server:
  1.  Server identifies the `cwd` (Current Working Directory).
  2.  `WorkspaceRegistry` retrieves known context for this path.
  3.  `AgentContext` is composed: `Global System Prompt` + `Project Specific Instructions` (if any).
  4.  **Automatic Contextualization**: If it's a new repo, the Agent scans `README.md` and `package.json` to generate a summary entry in Global Memory.

## 5. Implementation Steps

### Phase 1: Global Workspace Registry

- [x] Create `server/src/services/workspaces/workspace.registry.ts`.
- [x] Define `WorkspaceMetadata` schema (path, name, description, last_active, tech_tags).
- [x] Hook into `AgentServer.start()`: Register the current `cwd` into the registry.

### Phase 2: Template System Structure

- [x] Define `TemplateManifest` schema.
- [x] Create `USER/TEMPLATES/` directory.
- [x] Implement `TemplateLoader` service (similar to PackLoader).
- [x] Create default templates:
  - `monorepo`: Primary Template (Clone from `github.com/hexafield/template-monorepo`).

### Phase 3: The Scaffold Pack (`pai-scaffold-pack`)

- [x] Create `server/src/packs/standard/scaffold/index.ts`.
- [x] Implement tools:
  - `list_templates()`: Returns available templates.
  - `create_project_from_template(name, path)`:
    1. Copies files.
    2. Installs dependencies.
    3. Initializes git.
    4. Registers in `WorkspaceRegistry`.

### Phase 4: Context Contextualization

- [x] Modify `AgentRuntime` to include `Project Context` in the System Prompt.
- [x] Implement "First Load" logic:
  - If `!exists(.pai/alignment.md)`, generate it by analyzing the codebase.
  - Store a "Project Summary" in Global Memory (`knowledge.db`) linking the project path to keywords.

## 6. Principles Alignment

- **Global Memory**: Respects "Persistent Identity" by maintaining a continuous thread of "Who I am" across different "What I'm doing" (projects).
- **Templates**: Respects "Determinism First". Templates are static definitions, not hallucinated code.
- **Packs**: The Scaffolding capability is implemented as a standard Pack, keeping the core lean.

## 7. Future Integration

- **Dashboard**: The Frontend `FolderBrowser` can be updated to show "Recent Projects" from `workspaces.json` instead of just the filesystem.
- **Search**: Global Search tool can leverage `workspaces.json` to find code across all your projects, not just the open one.
