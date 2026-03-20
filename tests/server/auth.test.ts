// Author: be-api-router
import { Hono } from "hono";
import { createAuthMiddleware } from "../../src/server/auth";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const API_KEY = "test-secret-key";
const API_KEYS = new Set([API_KEY]);

const buildApp = (): Hono => {
  const app = new Hono();
  app.use("*", createAuthMiddleware(API_KEYS));
  app.get("/public", (c) => c.json({ ok: true }));
  app.post("/protected", (c) => c.json({ ok: true }));
  app.delete("/protected/:id", (c) => c.json({ ok: true }));
  return app;
};

describe("Auth Middleware", () => {
  const app = buildApp();

  describe("GET requests (public)", () => {
    it("allows GET without Authorization header", async () => {
      const res = await app.request("/public", { method: "GET" });
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.ok).toBe(true);
    });
  });

  describe("POST requests (protected)", () => {
    it("rejects POST without Authorization header", async () => {
      const res = await app.request("/protected", { method: "POST" });
      expect(res.status).toBe(401);
      const json: Json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_UNAUTHORIZED");
    });

    it("rejects POST with malformed Authorization header", async () => {
      const res = await app.request("/protected", {
        method: "POST",
        headers: { Authorization: "Basic abc123" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects POST with invalid API key", async () => {
      const res = await app.request("/protected", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-key" },
      });
      expect(res.status).toBe(401);
      const json: Json = await res.json();
      expect(json.error.code).toBe("ERR_UNAUTHORIZED");
    });

    it("allows POST with valid API key", async () => {
      const res = await app.request("/protected", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.ok).toBe(true);
    });
  });

  describe("DELETE requests (protected)", () => {
    it("rejects DELETE without Authorization header", async () => {
      const res = await app.request("/protected/123", { method: "DELETE" });
      expect(res.status).toBe(401);
    });

    it("allows DELETE with valid API key", async () => {
      const res = await app.request("/protected/123", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("multiple API keys", () => {
    it("accepts any valid key from the set", async () => {
      const multiKeyApp = new Hono();
      multiKeyApp.use("*", createAuthMiddleware(new Set(["key-a", "key-b"])));
      multiKeyApp.post("/test", (c) => c.json({ ok: true }));

      const resA = await multiKeyApp.request("/test", {
        method: "POST",
        headers: { Authorization: "Bearer key-a" },
      });
      expect(resA.status).toBe(200);

      const resB = await multiKeyApp.request("/test", {
        method: "POST",
        headers: { Authorization: "Bearer key-b" },
      });
      expect(resB.status).toBe(200);
    });
  });
});
