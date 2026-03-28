// Author: qa-01
import { Hono } from "hono";
import { createRateLimitMiddleware } from "../../src/server/rate-limit";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const API_KEY = "test-api-key";

const buildApp = (ipLimit?: number, keyLimit?: number): Hono => {
  const app = new Hono();
  app.use("*", createRateLimitMiddleware(ipLimit, keyLimit));
  app.get("/data", (c) => c.json({ ok: true }));
  app.post("/data", (c) => c.json({ ok: true }));
  app.delete("/data/:id", (c) => c.json({ ok: true }));
  return app;
};

const makeGetRequest = (app: Hono, ip = "1.2.3.4") =>
  app.request("/data", {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });

const makePostRequest = (app: Hono, ip = "1.2.3.4", key = API_KEY) =>
  app.request("/data", {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
      Authorization: `Bearer ${key}`,
    },
  });

const makeDeleteRequest = (app: Hono, ip = "1.2.3.4", key = API_KEY) =>
  app.request("/data/123", {
    method: "DELETE",
    headers: {
      "x-forwarded-for": ip,
      Authorization: `Bearer ${key}`,
    },
  });

describe("Rate Limit Middleware", () => {
  describe("requests within limit pass through", () => {
    it("allows GET requests under IP limit", async () => {
      const app = buildApp(5, 5);
      const res = await makeGetRequest(app);
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("allows POST requests under both limits", async () => {
      const app = buildApp(5, 5);
      const res = await makePostRequest(app);
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("allows DELETE requests under both limits", async () => {
      const app = buildApp(5, 5);
      const res = await makeDeleteRequest(app);
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("allows exactly ipLimit requests before blocking", async () => {
      const app = buildApp(3, 100);
      const res1 = await makeGetRequest(app);
      const res2 = await makeGetRequest(app);
      const res3 = await makeGetRequest(app);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });
  });

  describe("anonymous bucket enforcement (IP spoofing prevention)", () => {
    it("returns 429 when anonymous bucket limit is exceeded", async () => {
      const app = buildApp(2, 100);

      const res1 = await makeGetRequest(app);
      const res2 = await makeGetRequest(app);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const res3 = await makeGetRequest(app);
      expect(res3.status).toBe(429);
      const json: Json = await res3.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ERR_RATE_LIMITED");
      expect(json.error.message).toBe("Too many requests. Try again later.");
      expect(json.metadata.timestamp).toBeDefined();
    });

    it("different x-forwarded-for values share the same rate limit bucket", async () => {
      const app = buildApp(2, 100);

      // Two requests with different spoofed IPs still share the anonymous bucket
      const res1 = await makeGetRequest(app, "10.0.0.1");
      const res2 = await makeGetRequest(app, "10.0.0.2");
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Third request with yet another IP is still blocked
      const res3 = await makeGetRequest(app, "10.0.0.3");
      expect(res3.status).toBe(429);
    });

    it("different cf-connecting-ip values share the same rate limit bucket", async () => {
      const app = buildApp(1, 100);

      const res1 = await app.request("/data", {
        method: "GET",
        headers: { "cf-connecting-ip": "9.9.9.9" },
      });
      expect(res1.status).toBe(200);

      // Different cf-connecting-ip still shares the anonymous bucket
      const res2 = await app.request("/data", {
        method: "GET",
        headers: { "cf-connecting-ip": "8.8.8.8" },
      });
      expect(res2.status).toBe(429);
    });

    it("requests with no IP headers share the same anonymous bucket", async () => {
      const app = buildApp(1, 100);

      const res1 = await app.request("/data", { method: "GET" });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/data", { method: "GET" });
      expect(res2.status).toBe(429);
    });

    it("applies anonymous bucket limit to POST requests too", async () => {
      const app = buildApp(1, 100);

      const res1 = await makePostRequest(app);
      expect(res1.status).toBe(200);

      const res2 = await makePostRequest(app);
      expect(res2.status).toBe(429);
    });
  });

  describe("API key limit enforcement", () => {
    it("returns 429 when key limit is exceeded on POST", async () => {
      const app = buildApp(100, 2);

      const res1 = await makePostRequest(app, "10.0.0.1", "key-a");
      const res2 = await makePostRequest(app, "10.0.0.2", "key-a");
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const res3 = await makePostRequest(app, "10.0.0.3", "key-a");
      expect(res3.status).toBe(429);
    });

    it("tracks API keys independently", async () => {
      const app = buildApp(100, 1);

      const resA = await makePostRequest(app, "10.0.0.1", "key-a");
      const resB = await makePostRequest(app, "10.0.0.2", "key-b");
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const resA2 = await makePostRequest(app, "10.0.0.3", "key-a");
      expect(resA2.status).toBe(429);

      // key-b from different IP still blocked by key limit
      const resB2 = await makePostRequest(app, "10.0.0.4", "key-b");
      expect(resB2.status).toBe(429);
    });

    it("does not apply key limit to GET requests", async () => {
      const app = buildApp(100, 1);

      // Even with key limit of 1, GET requests pass because key is not checked
      const res1 = await makeGetRequest(app);
      const res2 = await makeGetRequest(app);
      const res3 = await makeGetRequest(app);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });
  });

  describe("GET vs POST/DELETE behavior", () => {
    it("GET is rate-limited by anonymous bucket only, not key", async () => {
      const app = buildApp(100, 1);

      // Multiple GETs pass (anonymous bucket limit is 100)
      const res1 = await makeGetRequest(app);
      const res2 = await makeGetRequest(app);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it("POST is rate-limited by both anonymous bucket and key", async () => {
      const app = buildApp(100, 1);

      // First POST passes both checks
      const res1 = await makePostRequest(app, "10.0.0.1", "shared-key");
      expect(res1.status).toBe(200);

      // Second POST from different IP but same key hits key limit
      const res2 = await makePostRequest(app, "10.0.0.2", "shared-key");
      expect(res2.status).toBe(429);
    });

    it("DELETE is rate-limited by both anonymous bucket and key", async () => {
      const app = buildApp(100, 1);

      const res1 = await makeDeleteRequest(app, "10.0.0.1", "del-key");
      expect(res1.status).toBe(200);

      const res2 = await makeDeleteRequest(app, "10.0.0.2", "del-key");
      expect(res2.status).toBe(429);
    });
  });

  describe("cleanup of expired entries", () => {
    it("purges entries from previous windows", async () => {
      const app = buildApp(1, 1);
      const middleware = createRateLimitMiddleware(1, 1);
      const store = middleware._store;

      // Simulate an old entry (window from 2 minutes ago)
      const oldWindow = Math.floor((Date.now() - 120_000) / 60_000) * 60_000;
      store.ipCounters.set("old-ip", { count: 5, windowStart: oldWindow });
      store.keyCounters.set("old-key", { count: 5, windowStart: oldWindow });

      // Simulate a current entry
      const currentWindow = Math.floor(Date.now() / 60_000) * 60_000;
      store.ipCounters.set("current-ip", { count: 1, windowStart: currentWindow });
      store.keyCounters.set("current-key", { count: 1, windowStart: currentWindow });

      expect(store.ipCounters.size).toBe(2);
      expect(store.keyCounters.size).toBe(2);

      // Call the actual purge function exposed for testing
      middleware._purge();

      // Old entries purged, current entries remain
      expect(store.ipCounters.size).toBe(1);
      expect(store.keyCounters.size).toBe(1);
      expect(store.ipCounters.has("current-ip")).toBe(true);
      expect(store.keyCounters.has("current-key")).toBe(true);
      expect(store.ipCounters.has("old-ip")).toBe(false);
      expect(store.keyCounters.has("old-key")).toBe(false);

      // Clean up timer
      clearInterval(middleware._cleanup);
    });

    it("resets counters when window rolls over", async () => {
      const middleware = createRateLimitMiddleware(1, 100);
      const testApp = new Hono();
      testApp.use("*", middleware);
      testApp.get("/data", (c) => c.json({ ok: true }));

      // First request in this window
      const r1 = await testApp.request("/data", {
        method: "GET",
      });
      expect(r1.status).toBe(200);

      // Set the stored entry to an old window to simulate time passing
      const oldWindow = Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
      middleware._store.ipCounters.set("anonymous", { count: 1, windowStart: oldWindow });

      // Now the same anonymous bucket should be allowed again (new window)
      const r2 = await testApp.request("/data", {
        method: "GET",
      });
      expect(r2.status).toBe(200);

      clearInterval(middleware._cleanup);
    });
  });

  describe("default limits", () => {
    it("uses default ipLimitPerMin=60 and keyLimitPerMin=120", async () => {
      const middleware = createRateLimitMiddleware();
      const app = new Hono();
      app.use("*", middleware);
      app.get("/data", (c) => c.json({ ok: true }));

      // Should allow 60 requests without hitting anonymous bucket limit
      const promises = Array.from({ length: 60 }, () =>
        app.request("/data", {
          method: "GET",
        }),
      );
      const results = await Promise.all(promises);
      results.forEach((res) => expect(res.status).toBe(200));

      // 61st should be blocked
      const blocked = await app.request("/data", {
        method: "GET",
      });
      expect(blocked.status).toBe(429);

      clearInterval(middleware._cleanup);
    });
  });

  describe("POST without Authorization header", () => {
    it("still applies anonymous bucket limit but skips key limit", async () => {
      const app = buildApp(2, 1);

      // POST without auth header - only anonymous bucket limit applies
      const res1 = await app.request("/data", {
        method: "POST",
        headers: { "x-forwarded-for": "20.20.20.20" },
      });
      const res2 = await app.request("/data", {
        method: "POST",
        headers: { "x-forwarded-for": "20.20.20.20" },
      });
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Third request hits anonymous bucket limit
      const res3 = await app.request("/data", {
        method: "POST",
        headers: { "x-forwarded-for": "20.20.20.20" },
      });
      expect(res3.status).toBe(429);
    });
  });
});
