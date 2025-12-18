import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpencodeManager } from "./opencode.js";
import { type Session } from "@opencode-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const manager = new OpencodeManager();

// Helper to unwrap SDK response
function unwrap<T>(res: { data: T } | T): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return res.data;
  }
  return res;
}

// Typed interface for SDK client
interface TypedClient {
  session: {
    list(): Promise<{ data: Session[] }>;
    create(args: { body: unknown }): Promise<{ data: Session }>;
    prompt(args: { path: { id: string }; body: unknown }): Promise<{ data: unknown }>;
    get?(args: { path: { id: string } }): Promise<{ data: Session }>;
    messages?(args: { path: { id: string } }): Promise<{ data: unknown[] }>;
  };
  file: {
    status(): Promise<{ data: unknown }>;
    read(args: { query: { path: string } }): Promise<{ data: unknown }>;
  };
}

interface AuthenticatedRequest extends express.Request {
  opencodeClient?: TypedClient;
  targetFolder?: string;
}

// Middleware to ensure connection
const withClient = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const folder = req.query.folder as string;
  if (!folder) {
    res.status(400).json({ error: "Missing folder query parameter" });
    return;
  }
  try {
    const client = await manager.connect(folder);
    (req as AuthenticatedRequest).opencodeClient = client as unknown as TypedClient;
    (req as AuthenticatedRequest).targetFolder = folder;
    next();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to connect: ${msg}` });
  }
};

app.post("/connect", async (req, res) => {
  const { folder } = req.body as { folder?: string };
  if (!folder) {
    res.status(400).json({ error: "Missing folder in body" });
    return;
  }
  try {
    await manager.connect(folder);
    res.json({ success: true, folder });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/sessions", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const folder = (req as AuthenticatedRequest).targetFolder!;
    
    let realFolder = folder;
    try {
        realFolder = await fs.realpath(folder);
    } catch (e) {
        // ignore
    }

    const response = await client.session.list();
    const sessions = unwrap(response);
    const filtered = Array.isArray(sessions) 
      ? sessions.filter((s) => s.directory === folder || s.directory === folder + '/' || s.directory === realFolder || s.directory === realFolder + '/')
      : sessions;
      
    res.json(filtered);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.post("/sessions", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const session = await client.session.create({ body: req.body });
    const data = unwrap(session);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/sessions/:id", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const { id } = req.params;
    
    // Check if 'get' method exists safely
    const sessionClient = client.session;

    if (typeof sessionClient.get === 'function') {
        const session = await sessionClient.get({ path: { id } });
        const data = unwrap(session) as any;
        
        if (typeof sessionClient.messages === 'function') {
            const messages = await sessionClient.messages({ path: { id } });
            data.history = unwrap(messages);
        }
        
        res.json(data);
    } else {
        const response = await client.session.list();
        const sessions = unwrap(response);
        const session = sessions.find((s) => s.id === id);
        if (session) res.json(session);
        else res.status(404).json({ error: "Session not found" });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.post("/sessions/:id/prompt", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const { id } = req.params;
    const result = await client.session.prompt({
      path: { id },
      body: req.body,
    });
    const data = unwrap(result);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/agents", withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!;
    const agents = await manager.listAgents(folder);
    res.json(agents);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.post("/agents", withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!;
    const { name, content } = req.body as { name: string; content: string };
    await manager.saveAgent(folder, name, content);
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/files/status", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const status = await client.file.status();
    const data = unwrap(status);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/files/read", withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!;
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ error: "Missing path query parameter" });
      return;
    }
    const content = await client.file.read({ query: { path } });
    const data = unwrap(content);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.get("/fs/list", async (req, res) => {
  const dirPath = req.query.path as string || os.homedir();
  console.log('Listing dir:', dirPath);
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }));
    // Sort directories first
    files.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    res.setHeader('x-current-path', dirPath);
    res.json(files);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Cleanup on exit
process.on("SIGINT", () => {
  manager.shutdown();
  process.exit();
});

export { app, manager };
