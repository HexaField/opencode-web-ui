# Product Requirement Document (PRD): Personal OS Agent

## 1. Executive Summary

The Personal OS Agent is a locally hosted, autonomous AI orchestration layer designed to act as a 24/7 proactive assistant. It functions as an integral part of the OpenCode system, running continuously to manage its own schedule, maintain persistent context, and interface with the user via a unified web dashboard. It is built to be a "second brain" that lives on the user's machine, respecting privacy and offering deep system integration.

## 2. Product Vision

To create a self-sovereign, highly capable AI infrastructure that **magnifies human potential**. Unlike generic agents that simply execute tasks, this system acts as a persistent **partner and assistant** that knows the user's goals (TELOS), learns from every interaction, and evolves to become the perfect interface to the digital world. The core philosophy is "User Centricity": the infrastructure adapts to the human, not the other way around.

## 3. Core Capabilities & Features

### 3.1 TELOS (Deep Goal Understanding)

- **Description**: The system is grounded in a deep understanding of _who_ the user is and _what_ they want to achieve.
- **Requirements**:
  - **Structured Identity**: Maintenance of `MISSION.md`, `GOALS.md`, `PROJECTS.md`, `BELIEFS.md`, `STRATEGIES.md`, etc.
  - **Contextual Alignment**: Every action and plan is checked against these core documents to ensure alignment with the user's higher-level objectives.

### 3.2 Continuous Learning (The "Outer Loop")

- **Description**: The system improves with use, moving beyond simple execution to genuine learning.
- **Micro-Reflection**: The agent analyzes completed sessions to extract facts and preferences.
- **Macro-consolidation**: Periodic "nightly" jobs consolidate insights into the long-term knowledge base, updating `LEARNED.md` and `config.json` automatically to reduce "config drift".

### 3.3 Persistent Local Memory (The "Exocortex")

- **Description**: Long-term storage of user preferences, project details, and interaction history.
- **Requirements**:
  - **Interaction History**: All chats from all channels stored locally in structured formats (Markdown/JSONL).
  - **Semantic Knowledge Base**: Retrieval-Augmented Generation (RAG) using local vector embeddings (e.g., `all-MiniLM-L6-v2`) to recall details from thousands of files/notes instantly.
  - **User Profile**: Explicit learning of user habits and preferences stored in readable Markdown files.

### 3.4 Global Context & Workspace Management

- **Description**: The agent operates across multiple projects ("Workspaces") simultaneously, maintaining a unified "Global Context".
- **Requirements**:
  - **Global Dashboard**: A central UI Hub for managing projects, viewing agent status, and initiating global tasks.
  - **Template System**: Composable "Project Stacks" for rapid scaffolding of new environments with pre-loaded context and dependencies.
  - **Context Switching**: Seamlessly shifting focus between "Global" (OS-level) and "Local" (Project-level) tasks.

### 3.5 System & Browser Control (Determinism First)

- **Description**: Deep, reliable integration with the host machine.
- **Philosophy**: "Goal → Code → CLI → Prompts → Agents". If a task can be solved deterministically with a script, it should be.
- **Requirements**:
  - **Shell Access**: Safe execution of shell commands.
  - **File Management**: Read/Write access to designated workspaces.
  - **Browser Automation**: Control over Chromium-based browsers (via Playwright) for "Headless" web tasks.
  - **App Control**: Integration with local applications (launching apps, controlling media).

### 3.6 Modular "Pack" System (Extensibility)

- **Description**: Modular capability system based on the "Pack" concept.
- **Requirements**:
  - **Packs**: Self-contained bundles of Skills, Hooks, Prompts, and Config.
  - **Standardized Interface**: `AgentSkills` spec for defining inputs, outputs, and side effects.
  - **Community Registry**: Support for external skill loading.
  - **Self-Evolution**: The agent can generate code for new skills, validate them, and install them as new Packs.

### 3.7 Proactive Task Scheduling

- **Description**: A "True Scheduler" that allows the agent to initiate actions without human stimulus.
- **Requirements**:
  - **Cron Jobs**: Support for scheduled tasks defined in `jobs.json` (e.g., "Morning Briefing").
  - **Event Triggers**: Capability to wake up the agent via external webhooks or system events.
  - **Background Workers**: Asynchronous execution of long-running scripted tasks.

### 3.8 Personal Home Workspace (Digital Drive)

- **Description**: Access to the core User Data Directory as a first-class workspace.
- **Requirements**:
  - **Root Editing**: Users can open `~/.opencode` to directly edit `TELOS` files and config.
  - **Asset Storage**: Dedicated folders (`DOCS`, `MEDIA`) for non-code personal files.
  - **Inspector**: A transparent view into the Agent's memory and installed Packs.

## 4. User Stories

- **As a user**, I want my agent to reference my `GOALS.md` when prioritizing my morning briefing, so I focus on what truly matters.
- **As a user**, I want to provide feedback on a task ("This was wrong, do it this way next time"), and have the agent update its `LEARNED.md` file so it never makes that mistake again.
- **As a user**, I want to install a "Research Pack" that gives my agent specific tools for OSINT and academic research without affecting other parts of the system.
- **As a user**, I want the agent to remember that I prefer Python for scripting tasks so I don't have to specify it every time.

- **As a user**, I want to manage multiple projects from a single dashboard and apply a "React + Vite" template to a new one instantly.

## 5. Non-Functional Requirements

- **User/System Separation**: Strict separation of "System" code (the engine) and "User" configuration/data (TELOS files, custom packs). Upgrading the system must never overwrite user identity.
- **Privacy & Security**: All data stays local. API keys are stored in a secure local vault/env. The "Hook System" validates commands before execution.
- **Availability**: The system runs as a **unified background process** ensuring 99.9% uptime.
- **Performance**: Low memory footprint. Efficient context retrieval for large memory banks.
- **Portability**: Docker containerization (single container) for easy deployment on macOS, Linux, and Windows.
