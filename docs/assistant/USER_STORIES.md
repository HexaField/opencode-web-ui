# User Stories for Personal OS Agent

## 1. Global Context & Project Scaffolding

**Focus:** Testing the "Home Page" Dashboard, global context switching, and template system (Plan 09 & 08). **Goal:** Verifying that the agent can manage projects from a high level before diving into a specific workspace.

1.  **Start State:** Open the Web UI to the root URL (Dashboard View).
2.  **Action:**
    - Navigate to the "Create New Project" or "Scaffold" section.
    - Select a template (e.g., "React", "Node", or "Empty").
    - Name the project "Test-Project-Alpha" and click Create.
3.  **Expected Result:**
    - The system initializes the folder structure on your disk.
    - The UI automatically redirects you to the new workspace integration.
    - The Agent's context switches from "Global" to "Local (Test-Project-Alpha)".
4.  **Verification:** Ask the agent "Where are we?" and it should identify the new project by name and path.

## 2. The "TELOS" Alignment & Memory

**Focus:** Testing Persistent Memory, Identity (`MISSION.md`), and Principles (Plan 14 & PRD Section 3.1). **Goal:** Verifying that the agent adapts to user instructions and retains them across sessions.

1.  **Start State:** Inside the "Test-Project-Alpha" workspace.
2.  **Action:**
    - Open the `~/.opencode/MISSION.md` (or equivalent identity file via the UI if available, or tell the agent directly).
    - Tell the agent: _"I prefer strict TypeScript typing and I always want you to add comments to complex logic."_
    - Ask the agent to generate a simple `calc.ts` file with a `sum` function.
3.  **Expected Result:**
    - The generated code should strictly follow the preference (TypeScript + Comments).
    - The agent should acknowledge it is following your preferences.
4.  **Verification:** Restart the session/agent. Ask "What are my coding preferences?". It should retrieve the rule about TypeScript and comments from its internal memory/journals.

## 3. Skill Execution (The "Pack" System)

**Focus:** Testing the Modular Pack System and Browser Control (Plan 03 & PRD Section 3.6). **Goal:** Verifying the agent can use external tools to affect the world.

1.  **Start State:** Global Chat or Workspace Chat.
2.  **Action:**
    - Give a command that requires a tool: _"Go to `example.com`, read the title of the page, and save it to a file called `research.md` in this folder."_
3.  **Expected Result:**
    - The agent identifies it needs the **Browser Pack** (Playwright).
    - It executes the browser navigation step (invisible or visible depending on headless mode).
    - It identifies it needs the **Filesystem Tool** to save the file.
4.  **Verification:** A file `research.md` appears in your file explorer containing "Example Domain".
