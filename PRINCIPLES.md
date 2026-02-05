# Principles

This project aligns with the philosophy of the [Personal AI Infrastructure (PAI)](https://github.com/danielmiessler/Personal_AI_Infrastructure). These principles guide every architectural decision.

### 1. User Centricity

The system is built around **you**, not the tools. Your goals (`TELOS`), preferences, and history come first. The infrastructure adapts to the human, not the other way around.

### 2. User/System Separation

**Strict separation** between the engine and the driver.

- `SYSTEM/`: The core code (this repo). Upgradable, immutable by the agent.
- `USER/`: Your identity (`MISSION.md`), memory, and config. Portable and sacred. _We never overwrite user data during an upgrade._

### 3. Modularity (Packs)

Everything is a **Pack**.

- Core features? That's a Pack.
- Browser automation? That's a Pack.
- Custom workflow? That's a Pack. This ensures the system is extensible, debuggable, and allows you to install only what you need (e.g., "Architecture V2").

### 4. Determinism First

**Code > CLI > Prompts > Agents.** If a task can be solved with a deterministic script (TypeScript/Bash), do that. Only use the LLM (Agent) when fuzzy reasoning is actually required. Reliability > Magic.

### 5. Persistent Identity (Assistant > Agent)

The goal is to build a long-term **Assistant**, not a stateless Agent.

- It remembers your history (Warm/Cold Storage).
- It knows your goals (TELOS).
- It learns from mistakes ("Outer Loop" learning).

### 6. Security by Design

The "Immune System" (Hooks) is always on.

- Dangerous commands (`rm -rf`) are blocked or require confirmation.
- You shouldn't have to run in "God Mode" to be productive.
