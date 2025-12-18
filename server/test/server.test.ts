import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, manager } from "../src/server.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("Server Integration Tests", () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create a temp dir for the "project"
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-test-"));
    // Initialize a dummy package.json so it looks like a project
    await fs.writeFile(path.join(tempDir, "package.json"), "{}");
    // Create a dummy file to read
    await fs.writeFile(path.join(tempDir, "test.txt"), "Hello World");
  });

  afterAll(async () => {
    manager.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should connect to a folder", async () => {
    const res = await request(app)
      .post("/connect")
      .send({ folder: tempDir });
    
    expect(res.status).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
  });

  it("should list sessions (initially empty)", async () => {
    const res = await request(app)
      .get(`/sessions?folder=${encodeURIComponent(tempDir)}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should create a session", async () => {
    const res = await request(app)
      .post(`/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ body: { title: "Test Session" } });
    
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBeDefined();
  });

  it("should create and list agents", async () => {
    const agentName = "test-agent";
    const agentContent = "You are a test agent.";

    // Create agent
    const createRes = await request(app)
      .post(`/agents?folder=${encodeURIComponent(tempDir)}`)
      .send({ name: agentName, content: agentContent });
    
    expect(createRes.status).toBe(200);

    // List agents
    const listRes = await request(app)
      .get(`/agents?folder=${encodeURIComponent(tempDir)}`);
    
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    
    interface Agent { name: string; content: string }
    const agents = listRes.body as Agent[];
    const agent = agents.find((a) => a.name === agentName);
    expect(agent).toBeDefined();
    expect(agent?.content).toBe(agentContent);
  });

  it("should get file status", async () => {
    const res = await request(app)
      .get(`/files/status?folder=${encodeURIComponent(tempDir)}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should read a file", async () => {
    const res = await request(app)
      .get(`/files/read?folder=${encodeURIComponent(tempDir)}&path=test.txt`);
    
    expect(res.status).toBe(200);
    expect((res.body as { content: string }).content).toBe("Hello World");
  });

  it("should list files in a directory", async () => {
    const res = await request(app)
      .get(`/fs/list?path=${encodeURIComponent(tempDir)}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const files = res.body as { name: string; isDirectory: boolean }[];
    expect(files.find(f => f.name === "package.json")).toBeDefined();
    expect(files.find(f => f.name === "test.txt")).toBeDefined();
  });

  it("should get session details", async () => {
    // Create session first
    const createRes = await request(app)
      .post(`/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ body: { title: "Detail Session" } });
    
    interface SessionResponse { id: string; [key: string]: unknown }
    const sessionId = (createRes.body as SessionResponse).id;

    const res = await request(app)
      .get(`/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`);
    
    expect(res.status).toBe(200);
    expect((res.body as SessionResponse).id).toBe(sessionId);
  });

  it("should handle a multi-turn conversation", async () => {
    // 1. Create session
    const createRes = await request(app)
      .post(`/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ body: { title: "Chat Session" } });
    
    interface SessionResponse { id: string; [key: string]: unknown }
    const sessionId = (createRes.body as SessionResponse).id;

    // 2. Send first message
    const msg1 = "Hello, who are you?";
    const res1 = await request(app)
      .post(`/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({ parts: [{ type: "text", text: msg1 }] });
    
    expect(res1.status).toBe(200);
    // Expect some content in response
    const body1 = res1.body as { parts?: { type: string; text?: string }[] };
    const content1 = body1.parts?.find(p => p.type === 'text')?.text;
    expect(content1).toBeDefined();
    expect(typeof content1).toBe('string');

    // 3. Send second message
    const msg2 = "What did I just say?";
    const res2 = await request(app)
      .post(`/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({ parts: [{ type: "text", text: msg2 }] });
    
    expect(res2.status).toBe(200);
    const body2 = res2.body as { parts?: { type: string; text?: string }[] };
    const content2 = body2.parts?.find(p => p.type === 'text')?.text;
    expect(content2).toBeDefined();
    expect(typeof content2).toBe('string');

    // 4. Verify history
    const sessionRes = await request(app)
      .get(`/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`);
    
    expect(sessionRes.status).toBe(200);
    const sessionData = sessionRes.body as { history: any[] };
    expect(Array.isArray(sessionData.history)).toBe(true);
    expect(sessionData.history.length).toBeGreaterThan(0);
    // Check if history items have parts and info
    const firstMsg = sessionData.history[0];
    expect(firstMsg.parts).toBeDefined();
    expect(firstMsg.info).toBeDefined();
    expect(firstMsg.info.role).toBeDefined();
  }, 30000);
});
