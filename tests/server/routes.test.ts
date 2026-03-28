// Author: be-api-router
import { createApp, DEFAULT_SERVER_CONFIG } from "../../src/server/routes";
import type { ServerConfig } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";
import * as endpointPolicy from "../../src/server/endpoint-policy";

// Load endpoints.json — same single source of truth the server uses
const ENDPOINTS_DEF = JSON.parse(
  readFileSync(resolve(__dirname, "../../skill/endpoints.json"), "utf-8"),
);
const EXPECTED_ENDPOINT_MAP = Object.fromEntries(
  Object.entries(ENDPOINTS_DEF.endpoints as Record<string, { path: string }>)
    .map(([k, v]) => [k, v.path]),
);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

describe("Agent CRUD Routes", () => {
  const validBody = {
    agent_id: "agent-beta@chorus.example",
    endpoint: "https://beta.example.com/receive",
    agent_card: {
      card_version: "0.3",
      user_culture: "zh-CN",
      supported_languages: ["zh-CN", "en"],
    },
  };

  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;

  beforeEach(() => {
    db = createTestDb();
    registry = new AgentRegistry(db);
    app = createApp(registry);
  });

  afterEach(() => {
    db.close();
  });

  describe("POST /agents", () => {
    it("creates a new agent and returns 201", async () => {
      const res = await app.request("/agents", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(201);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.agent_id).toBe(validBody.agent_id);
      expect(json.data.endpoint).toBe(validBody.endpoint);
      expect(json.metadata.timestamp).toBeDefined();
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await app.request("/agents", {
        method: "POST",
        body: JSON.stringify({ agent_id: "x" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_VALIDATION");
      expect(json.error.message).toBeDefined();
    });

    it("returns 400 for invalid endpoint URL", async () => {
      const res = await app.request("/agents", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          endpoint: "not-a-url",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns 200 when re-registering a duplicate agent_id", async () => {
      await app.request("/agents", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      });

      const updatedBody = {
        ...validBody,
        endpoint: "https://beta-v2.example.com/receive",
      };
      const res = await app.request("/agents", {
        method: "POST",
        body: JSON.stringify(updatedBody),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.endpoint).toBe(updatedBody.endpoint);
    });

    it("returns 429 when registry is full", async () => {
      const tinyDb = createTestDb();
      const tinyRegistry = new AgentRegistry(tinyDb, 1);
      const tinyApp = createApp(tinyRegistry, { maxAgents: 1, maxBodyBytes: 65536, rateLimitPerMin: 60 });

      // Fill the registry
      await tinyApp.request("/agents", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      });

      // Try to register a second agent
      const res = await tinyApp.request("/agents", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          agent_id: "agent-gamma@chorus.example",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(429);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_REGISTRY_FULL");
      tinyDb.close();
    });
  });

  describe("GET /agents", () => {
    it("returns 200 with list of agents", async () => {
      registry.register("a1@host", "https://a1.example.com", {
        card_version: "0.3",
        user_culture: "en-US",
        supported_languages: ["en"],
      });

      const res = await app.request("/agents");

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].agent_id).toBe("a1@host");
    });

    it("returns empty array when no agents registered", async () => {
      const res = await app.request("/agents");

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.data).toEqual([]);
    });
  });

  describe("GET /agents/:id", () => {
    it("returns 200 with agent data for existing agent", async () => {
      registry.register("a1@host", "https://a1.example.com", {
        card_version: "0.3",
        user_culture: "en-US",
        supported_languages: ["en"],
      });

      const res = await app.request("/agents/a1@host");

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.agent_id).toBe("a1@host");
    });

    it("returns 404 for unknown agent", async () => {
      const res = await app.request("/agents/ghost@host");

      expect(res.status).toBe(404);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_AGENT_NOT_FOUND");
    });
  });

  describe("DELETE /agents/:id", () => {
    it("returns 200 when deleting existing agent", async () => {
      registry.register("a1@host", "https://a1.example.com", {
        card_version: "0.3",
        user_culture: "en-US",
        supported_languages: ["en"],
      });

      const res = await app.request("/agents/a1@host", { method: "DELETE" });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(registry.get("a1@host")).toBeUndefined();
    });

    it("returns 404 when deleting unknown agent", async () => {
      const res = await app.request("/agents/ghost@host", { method: "DELETE" });

      expect(res.status).toBe(404);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_AGENT_NOT_FOUND");
    });
  });

  describe("GET /.well-known/chorus.json", () => {
    it("returns discovery document with version and endpoints", async () => {
      const res = await app.request("/.well-known/chorus.json", { method: "GET" });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.chorus_version).toBe("0.4");
      expect(json.server_name).toBe("Chorus Public Alpha Hub");
      expect(json.endpoints).toEqual(EXPECTED_ENDPOINT_MAP);
    });

    it("includes server_status, limits, and warnings", async () => {
      const customDb = createTestDb();
      const customConfig: ServerConfig = { maxAgents: 50, maxBodyBytes: 32768, rateLimitPerMin: 30 };
      const customApp = createApp(new AgentRegistry(customDb, 50), customConfig);

      const res = await customApp.request("/.well-known/chorus.json", { method: "GET" });
      const json: Json = await res.json();

      expect(json.server_status).toBe("alpha");
      expect(json.limits).toEqual({
        max_agents: 50,
        max_message_bytes: 32768,
        rate_limit_per_minute: 30,
      });
      expect(json.warnings).toEqual([
        "experimental — registry may reset without notice",
        "no identity guarantees",
        "do not send sensitive content",
      ]);
      customDb.close();
    });
  });

  describe("GET /health", () => {
    it("returns status ok with version and uptime", async () => {
      const res = await app.request("/health", { method: "GET" });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("ok");
      expect(json.data.version).toBe("0.7.0-alpha");
      expect(typeof json.data.uptime_seconds).toBe("number");
      expect(json.data.uptime_seconds).toBeGreaterThanOrEqual(0);
    });

    it("includes registry stats in health response", async () => {
      registry.register("a1@host", "https://a1.example.com", {
        card_version: "0.3",
        user_culture: "en-US",
        supported_languages: ["en"],
      });
      registry.recordDelivery();
      registry.recordDelivery();
      registry.recordFailure();

      const res = await app.request("/health", { method: "GET" });
      const json: Json = await res.json();

      expect(json.data.agents_registered).toBe(1);
      expect(json.data.messages_delivered).toBe(2);
      expect(json.data.messages_failed).toBe(1);
    });
  });

  describe("GET /invite/:id — XSS prevention", () => {
    it("escapes HTML in agent_id to prevent reflected XSS", async () => {
      const maliciousId = '<img src=x onerror=alert(1)>@evil';
      registry.register(maliciousId, "https://evil.example.com", {
        card_version: "0.3",
        user_culture: '<script>alert("xss")</script>',
        supported_languages: ["en"],
      });

      const res = await app.request(`/invite/${encodeURIComponent(maliciousId)}`, {
        headers: { Accept: "text/html" },
      });

      expect(res.status).toBe(200);
      const html = await res.text();
      // Must NOT contain raw angle brackets from user input
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain("<script>");
      // Must contain escaped versions
      expect(html).toContain("&lt;img");
      expect(html).toContain("&lt;script&gt;");
    });

    it("returns JSON with raw agent_id when Accept: application/json", async () => {
      const agentId = "test-agent@chorus.example";
      registry.register(agentId, "https://test.example.com", {
        card_version: "0.3",
        user_culture: "en-US",
        supported_languages: ["en"],
      });

      const res = await app.request(`/invite/${agentId}`, {
        headers: { Accept: "application/json" },
      });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.agent_id).toBe(agentId);
    });
  });

  describe("Static pages", () => {
    it("GET /skill returns markdown by default", async () => {
      const res = await app.request("/skill");
      expect(res.status).toBe(200);
      const ct = res.headers.get("Content-Type") ?? "";
      expect(ct).toContain("text/markdown");
    });

    it("GET /skill returns HTML when Accept: text/html", async () => {
      const res = await app.request("/skill", {
        headers: { Accept: "text/html" },
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("<!DOCTYPE html>");
    });

    it("GET /console returns HTML", async () => {
      const res = await app.request("/console");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("html");
    });

    it("GET /arena returns HTML", async () => {
      const res = await app.request("/arena");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("html");
    });
  });

  describe("Health endpoint", () => {
    it("GET /health includes messages_queued stat", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.data).toHaveProperty("messages_queued");
    });
  });
});

// ---------------------------------------------------------------------------
// H-08: agent_id format enforcement (name@host)
// ---------------------------------------------------------------------------

describe("Agent ID Format Enforcement (POST /agents)", () => {
  const validCard = { card_version: "0.3", user_culture: "en", supported_languages: ["en"] };

  let db: ReturnType<typeof createTestDb>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createTestDb();
    const registry = new AgentRegistry(db);
    app = createApp(registry);
  });

  afterEach(() => {
    db.close();
  });

  it("rejects agent_id without @ separator", async () => {
    const res = await app.request("/agents", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "nohostpart",
        endpoint: "https://example.com/receive",
        agent_card: validCard,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects agent_id with empty name before @", async () => {
    const res = await app.request("/agents", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "@noname",
        endpoint: "https://example.com/receive",
        agent_card: validCard,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
  });

  it("accepts valid name@host agent_id", async () => {
    const res = await app.request("/agents", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "valid@host.example",
        endpoint: "https://example.com/receive",
        agent_card: validCard,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C-04: SSRF protection — endpoint validation at registration
// ---------------------------------------------------------------------------

describe("Endpoint SSRF Protection", () => {
  const validCard = { card_version: "0.3", user_culture: "en", supported_languages: ["en"] };

  const blockedEndpoints = [
    "http://127.0.0.1:8080/receive",
    "http://localhost:8080/receive",
    "http://10.0.0.1:8080/receive",
    "http://172.16.0.1:8080/receive",
    "http://192.168.1.1:8080/receive",
    "http://169.254.169.254/latest/meta-data/",
    "http://0.0.0.0:8080/receive",
  ];

  blockedEndpoints.forEach((endpoint) => {
    it(`POST /register rejects private endpoint: ${endpoint}`, async () => {
      const db = createTestDb();
      const registry = new AgentRegistry(db);
      const app = createApp(registry);

      const res = await app.request("/register", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "ssrf@hub",
          agent_card: validCard,
          endpoint,
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
      const json: Json = await res.json();
      expect(json.error.code).toBe("ERR_ENDPOINT_BLOCKED");
    });
  });

  it("POST /register allows public endpoint", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "public@hub",
        agent_card: validCard,
        endpoint: "https://example.com/receive",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
  });

  it("POST /register allows registration without endpoint", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "no-ep@hub",
        agent_card: validCard,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
  });

  it("POST /register rejects hostname that resolves to private IP (DNS rebinding)", async () => {
    // Mock resolveAndCheckEndpoint to simulate DNS resolving to 127.0.0.1
    const spy = jest.spyOn(endpointPolicy, "resolveAndCheckEndpoint")
      .mockResolvedValueOnce({ allowed: false, reason: "Hostname evil.example resolves to blocked IP 127.0.0.1" });

    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "rebind@hub",
        agent_card: validCard,
        endpoint: "https://evil.example/receive",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.error.code).toBe("ERR_ENDPOINT_BLOCKED");
    expect(json.error.message).toContain("127.0.0.1");

    spy.mockRestore();
  });

  it("POST /register rejects hostname resolving to 10.x private range", async () => {
    const spy = jest.spyOn(endpointPolicy, "resolveAndCheckEndpoint")
      .mockResolvedValueOnce({ allowed: false, reason: "Hostname internal.corp resolves to blocked IP 10.0.0.5" });

    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "internal@hub",
        agent_card: validCard,
        endpoint: "https://internal.corp/receive",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.error.code).toBe("ERR_ENDPOINT_BLOCKED");

    spy.mockRestore();
  });

  it("POST /register rejects hostname resolving to link-local (169.254.x)", async () => {
    const spy = jest.spyOn(endpointPolicy, "resolveAndCheckEndpoint")
      .mockResolvedValueOnce({ allowed: false, reason: "Hostname metadata.local resolves to blocked IP 169.254.169.254" });

    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "metadata@hub",
        agent_card: validCard,
        endpoint: "https://metadata.local/receive",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.error.code).toBe("ERR_ENDPOINT_BLOCKED");

    spy.mockRestore();
  });
});
