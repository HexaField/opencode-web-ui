# Implementation Plan 6: System & Browser Control (Advanced Skills)

## 1. Overview

This plan implements the complex capabilities that give the agent "Superpowers": Browser Automation and advanced System Control. These appear as standard Packs but have significant internal complexity.

## 2. Dependencies

- **Pre-requisites**: `PLAN_03_PACK_SYSTEM.md`.
- **Next Steps**: `PLAN_07_INTEGRATIONS.md`.

## 3. High-Level Design

### 3.1 Playwright Pack (`pai-browser-pack`)

- A specialized Pack wrapping `playwright`.
- Tools exposed:
  - `browser_navigate(url)`
  - `browser_screenshot()`
  - `browser_click_element(selector)`
  - `browser_extract_text()`
- **Headless Mode**: Configurable via `USER/CONFIG/browser.json`.
- **Session Persistence**: Maintain browser state (cookies) across tool calls within a session.

### 3.2 System Control Pack

- Refinement of `pai-shell-pack`.
- Add tools for OS-specific automation:
  - `open_application(appName)` (macOS/Windows)
  - `media_control(play/pause)`
  - `notification_send(msg)` (System native notifs).

## 4. Implementation Steps

### Phase 1: Playwright Infrastructure

- [x] Install `playwright`.
- [x] Create `server/src/packs/standard/browser/index.ts`.
- [x] Implement the `BrowserManager` class to hold the Playwright instance.

### Phase 2: Browser Tools Implementation

- [x] Implement Navigation, Click, Type, Extract tools.
- [x] Add accessibility snapshotting (converting DOM to LLM-friendly text representation).

### Phase 3: Advanced System Tools

- [x] Create `server/src/packs/standard/system/index.ts`.
- [x] Implement `open` (macOS `open`, Linux `xdg-open`) wrapper.

## 5. Files to Create/Edit

- `server/src/packs/standard/browser/index.ts`
- `server/src/packs/standard/browser/browser-manager.ts`
- `server/src/packs/standard/system/index.ts`

## 6. Verification

- Enable `pai-browser-pack`.
- Ask Agent: "Go to news.ycombinator.com and tell me the top headline."
- Agent should: Launch browser (invisible or visible), navigate, read accessible tree, extract text, and reply.
