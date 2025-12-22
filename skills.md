# Implementation Plan: Agent Skills Support

This document outlines the plan to add "Agent Skills" functionality to the `opencode-web-ui` repository. This feature allows the agent to dynamically load specialized instructions and resources based on the user's prompt.

## Overview

The goal is to enable the agent to discover and utilize "skills" defined in the `.agent/skills` directory (replacing the standard `.github/skills` location). A skill is a directory containing a `SKILL.md` file with instructions and optional resources.

## Architecture

### 1. Skill Discovery (`server/src/skills.ts`)
A new module will be created to handle skill management.

*   **Location**: `server/src/skills.ts`
*   **Responsibilities**:
    *   Scan the `.agent/skills` directory in the workspace.
    *   Parse `SKILL.md` files (YAML frontmatter + Markdown body).
    *   Cache loaded skills for performance.

### 2. Skill Resolution
We need a mechanism to decide which skills are relevant to a user's prompt.

*   **Logic**:
    *   Iterate through available skills.
    *   Compare the user's prompt against the skill's `description` (defined in frontmatter).
    *   **MVP**: Use keyword matching or simple text overlap.
    *   **Future**: Use an embedding-based semantic router or an LLM call to select skills.

### 3. Context Injection (`server/src/server.ts`)
The resolved skills need to be injected into the agent's context.

*   **Integration Point**: `POST /api/sessions/:id/prompt`
*   **Mechanism**:
    *   Before sending the prompt to the `OpencodeClient`:
    *   Call `SkillManager.findRelevantSkills(folder, prompt)`.
    *   If skills are found, append their content to the user's message or system prompt.
    *   Format:
        ```text
        [User Prompt]

        ---
        Active Skills:
        
        ## [Skill Name]
        [Skill Instructions]
        ```

## Implementation Steps

### Step 1: Create `server/src/skills.ts`

Define the `Skill` interface and `SkillManager` class.

```typescript
export interface Skill {
  name: string;
  description: string;
  content: string; // The markdown body
  path: string;    // Path to the skill directory
}

export class SkillManager {
  async loadSkills(folder: string): Promise<Skill[]> {
    // 1. Check if .agent/skills exists
    // 2. Read subdirectories
    // 3. Parse SKILL.md frontmatter
  }

  matchSkills(prompt: string, skills: Skill[]): Skill[] {
    // Simple keyword matching implementation
    const lowerPrompt = prompt.toLowerCase();
    return skills.filter(skill => {
      // Check if description keywords appear in prompt
      // This is a placeholder for more advanced routing
      return lowerPrompt.includes(skill.name) || 
             skill.description.toLowerCase().split(' ').some(word => lowerPrompt.includes(word));
    });
  }
}
```

### Step 2: Update `server/src/server.ts`

Integrate the `SkillManager` into the prompt handling flow.

1.  Instantiate `SkillManager`.
2.  In `POST /api/sessions/:id/prompt`:
    ```typescript
    const skills = await skillManager.loadSkills(folder);
    const relevantSkills = skillManager.matchSkills(body.prompt, skills);
    
    if (relevantSkills.length > 0) {
      const skillContext = relevantSkills.map(s => `## ${s.name}\n${s.content}`).join('\n\n');
      body.prompt += `\n\n--- \nActive Skills:\n${skillContext}`;
    }
    ```

### Step 3: Frontend Updates (Optional)
*   Add a visual indicator in the UI when skills are active.
*   Allow users to manually enable/disable skills (future scope).

## Directory Structure

```text
.agent/skills/
├── my-skill/
│   ├── SKILL.md
│   └── script.py
└── another-skill/
    └── SKILL.md
```

## Verification

1.  Create a test skill in `.agent/skills/test-skill/SKILL.md`.
2.  Send a prompt that triggers the skill.
3.  Verify that the agent follows the instructions defined in the skill.
