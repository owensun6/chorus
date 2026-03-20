// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";

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

  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    app = createApp(registry);
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

  describe("GET /health", () => {
    it("returns status ok with version and uptime", async () => {
      const res = await app.request("/health", { method: "GET" });

      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("ok");
      expect(json.data.version).toBe("1.0.0");
      expect(typeof json.data.uptime_seconds).toBe("number");
      expect(json.data.uptime_seconds).toBeGreaterThanOrEqual(0);
    });
  });
});
