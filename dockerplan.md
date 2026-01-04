This document outlines the architecture and implementation plan for adding a generic, GitHub Actions-like CI system to your IDE using **Docker-in-Docker (DinD)** for full isolation and **Radicle** as the source of truth.

---

# Architecture Specification: "Forge" CI System

## 1. High-Level Architecture

The system consists of three distinct layers:

1. **The Orchestrator (Host/Express):** Manages the job queue, speaks to the Docker Daemon, and streams logs to the frontend via WebSockets.
2. **The Runner (Docker Container):** A privileged container running `docker:dind`. It provides the isolated OS and the Docker Daemon for the user's workflow.
3. **The Agent (Internal Node.js Process):** A script running *inside* the Runner that clones the Radicle repo and executes the user's YAML steps.

### Data Flow

1. **Trigger:** User clicks "Run" or pushes code -> Express Backend receives event.
2. **Queue:** Job is added to `BullMQ` (Redis) to handle concurrency.
3. **Spawn:** Worker picks job -> Uses `dockerode` to start a **DinD Runner**.
4. **Clone:** The Runner uses `git` to pull code from the **Radicle HTTP Gateway**.
5. **Execute:** Runner executes commands (e.g., `npm install`, `docker build`).
6. **Stream:** Logs are piped from Runner `stdout` -> Express -> Socket.io -> Monaco Terminal.

---

## 2. The Runner Image (DinD + Node Agent)

We need a custom Docker image extending the official Docker-in-Docker image. It must include Node.js (to run our logic) and Git (to clone the repo).

**`Dockerfile.runner`**

```dockerfile
# Start from the official Docker-in-Docker image
FROM docker:24-dind

# Install dependencies: Node.js (for the agent), Git (for cloning), and Bash
RUN apk add --no-cache nodejs npm git bash curl

# Create the working directory for the user's code
WORKDIR /workspace

# Copy the "Agent" script (the logic that runs the steps)
COPY agent.js /usr/local/bin/agent.js

# Entrypoint script to start the internal Docker daemon AND our agent
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

```

**`entrypoint.sh`**

```bash
#!/bin/sh
# 1. Start the Docker Daemon in the background
dockerd-entrypoint.sh &

# 2. Wait for Docker to be ready
while ! docker info > /dev/null 2>&1; do
  echo "Waiting for Docker Daemon..."
  sleep 1
done

# 3. Run the Node.js Agent which executes the CI steps
node /usr/local/bin/agent.js

```

---

## 3. The Agent Logic (Inside the Container)

This script runs inside the isolated container. It is responsible for parsing the CI steps and executing them.

**`agent.js`**

```javascript
const { execSpawn } = require('child_process');
// In a real app, you'd pull these from ENV variables injected by the Orchestrator
const RADICLE_ID = process.env.RADICLE_RID; // e.g., rad:z3gqc...
const RADICLE_SEED = process.env.RADICLE_SEED || 'https://pine.radicle.garden';
const STEPS = JSON.parse(process.env.CI_STEPS); // Array of commands

async function run() {
  try {
    console.log('--- 🚀 Starting Job ---');
    
    // 1. Clone from Radicle
    // We use the HTTP gateway format for easiest CI integration
    const cloneUrl = `${RADICLE_SEED}/${RADICLE_ID}.git`;
    console.log(`--- ⬇️ Cloning from ${cloneUrl} ---`);
    await execute(`git clone ${cloneUrl} .`);

    // 2. Execute User Steps
    for (const step of STEPS) {
      console.log(`--- 🏃 Running: ${step.name || step.run} ---`);
      await execute(step.run);
    }

    console.log('--- ✅ Job Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('--- ❌ Job Failed ---');
    console.error(err);
    process.exit(1);
  }
}

function execute(command) {
  return new Promise((resolve, reject) => {
    // We use spawn to stream output in real-time
    const { spawn } = require('child_process');
    const [cmd, ...args] = command.split(' ');
    
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
    
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

run();

```

---

## 4. The Orchestrator (Backend Implementation)

This code lives in your Express app. It requires `dockerode` and `bullmq`.

### A. Queue Setup (To handle parallelism)

```javascript
import { Queue, Worker } from 'bullmq';
import { runJob } from './dockerService';

const ciQueue = new Queue('ci-jobs');

// The Worker processes jobs one by one (or in parallel depending on concurrency)
const worker = new Worker('ci-jobs', async (job) => {
  const { radicleId, steps, socketId } = job.data;
  await runJob(radicleId, steps, socketId);
}, { 
  concurrency: 5 // Allow 5 parallel runners at once
});

```

### B. The Docker Service

```javascript
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function runJob(radicleId, steps, socketId) {
  const socket = getSocketById(socketId); // Your internal socket logic

  // Spin up the container
  const container = await docker.createContainer({
    Image: 'my-ide-runner:latest',
    Env: [
      `RADICLE_RID=${radicleId}`,
      `CI_STEPS=${JSON.stringify(steps)}`,
      // Pass authentication if cloning private Radicle repos
    ],
    HostConfig: {
      Privileged: true, // REQUIRED for DinD
      AutoRemove: true, // Clean up automatically
      // Resource Limits (Crucial for Parallelism)
      NanoCPus: 1000000000, // 1 CPU
      Memory: 512 * 1024 * 1024 // 512MB RAM
    }
  });

  await container.start();

  // Attach to logs and stream to frontend
  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true
  });

  stream.on('data', (chunk) => {
    // Send raw log data to the specific user's Monaco terminal
    socket.emit('terminal-output', chunk.toString());
  });

  // Wait for container to die (finish)
  await container.wait();
}

```

---

## 5. Frontend & Configuration

### The YAML Config

Users define this in their workspace.

```yaml
name: Build and Test
steps:
  - name: Install Dependencies
    run: npm install
  - name: Run Tests
    run: npm test
  - name: Build Docker Image
    run: docker build -t my-app .  # This works because of DinD!

```

### Frontend (SolidJS + Monaco)

1. **Terminals:** Use `xterm.js` (often used with Monaco) to render the output. It handles ANSI colors sent from the Docker logs perfectly.
2. **Socket:** Listen for `terminal-output` events and write them to the xterm instance.

---

## 6. Implementation Checklist

1. **Build the Runner Image:**
* Create `Dockerfile.runner`, `entrypoint.sh`, and `agent.js`.
* Build it: `docker build -t my-ide-runner:latest .`


2. **Backend Setup:**
* Install `dockerode` and `bullmq`.
* Ensure the host machine (where Express runs) has Docker installed and the backend has permissions to access `/var/run/docker.sock`.


3. **Radicle Connectivity:**
* Ensure your runner can reach the Radicle seed node (e.g., `pine.radicle.garden` or your own local node).
* *Note:* If using a local Radicle node, you may need to use `--network="host"` or special Docker networking, but standard public HTTP gateways are easiest.


4. **Security Hardening (Important):**
* Since you are running `Privileged: true` containers, a malicious user *could* theoretically escape the container.
* **Mitigation:** Only allow this for trusted users, or investigate **Sysbox** (a docker runtime that allows DinD *without* privileged mode) for higher security.
