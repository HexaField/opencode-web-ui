# OpenCode Web UI

A web-based interface for OpenCode, built with SolidJS, Tailwind CSS, and Vite.

## Features

- **Folder Browser**: Navigate your local file system to select a workspace.
- **Chat Interface**: Interact with the OpenCode AI agent to discuss and modify your code.
- **Git Integration**: View changes, branches, and commit history.
- **Workspace Management**: Switch between different coding sessions.

## Tech Stack

- **Frontend**: SolidJS, Tailwind CSS, Vite
- **Backend**: Express, @opencode-ai/sdk
- **Testing**: Playwright, Vitest

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- pnpm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Running the Application

Start both the server and the client in development mode:

```bash
pnpm dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

### Running Tests

- E2E Tests: `pnpm test:e2e`

## License

MIT
