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

  describe("IP limit enforcement", () => {
    it("returns 429 when IP limit is exceeded", async () => {
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

    it("tracks IPs independently", async () => {
      const app = buildApp(1, 100);

      const resA = await makeGetRequest(app, "10.0.0.1");
      const resB = await makeGetRequest(app, "10.0.0.2");
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const resA2 = await makeGetRequest(app, "10.0.0.1");
      expect(resA2.status).toBe(429);

      const resB2 = await makeGetRequest(app, "10.0.0.2");
      expect(resB2.status).toBe(429);
    });

    it("applies IP limit to POST requests too", async () => {
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
    it("GET is rate-limited by IP only, not key", async () => {
      const app = buildApp(100, 1);

      // Multiple GETs from same IP pass (IP limit is 100)
      const res1 = await makeGetRequest(app);
      const res2 = await makeGetRequest(app);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it("POST is rate-limited by both IP and key", async () => {
      const app = buildApp(100, 1);

      // First POST passes both checks
      const res1 = await makePostRequest(app, "10.0.0.1", "shared-key");
      expect(res1.status).toBe(200);

      // Second POST from different IP but same key hits key limit
      const res2 = await makePostRequest(app, "10.0.0.2", "shared-key");
      expect(res2.status).toBe(429);
    });

    it("DELETE is rate-limited by both IP and key", async () => {
      const app = buildApp(100, 1);

      const res1 = await makeDeleteRequest(app, "10.0.0.1", "del-key");
      expect(res1.status).toBe(200);

      const res2 = await makeDeleteRequest(app, "10.0.0.2", "del-key");
      expect(res2.status).toBe(429);
    });
  });

  describe("IP extraction", () => {
    it("uses x-forwarded-for first entry when multiple IPs present", async () => {
      const app = buildApp(1, 100);

      const res1 = await app.request("/data", {
        method: "GET",
        headers: { "x-forwarded-for": "5.5.5.5, 6.6.6.6" },
      });
      expect(res1.status).toBe(200);

      // Same first IP should be rate-limited
      const res2 = await app.request("/data", {
        method: "GET",
        headers: { "x-forwarded-for": "5.5.5.5, 7.7.7.7" },
      });
      expect(res2.status).toBe(429);
    });

    it("falls back to cf-connecting-ip when x-forwarded-for is absent", async () => {
      const app = buildApp(1, 100);

      const res1 = await app.request("/data", {
        method: "GET",
        headers: { "cf-connecting-ip": "9.9.9.9" },
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/data", {
        method: "GET",
        headers: { "cf-connecting-ip": "9.9.9.9" },
      });
      expect(res2.status).toBe(429);
    });

    it("uses 'unknown' when no IP headers present", async () => {
      const app = buildApp(1, 100);

      const res1 = await app.request("/data", { method: "GET" });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/data", { method: "GET" });
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
      const app = buildApp(1, 100);

      const res1 = await makeGetRequest(app);
      expect(res1.status).toBe(200);

      // Exhaust the limit
      const res2 = await makeGetRequest(app);
      expect(res2.status).toBe(429);

      // Directly manipulate the store to simulate window rollover
      const middleware = createRateLimitMiddleware(1, 100);
      const testApp = new Hono();
      testApp.use("*", middleware);
      testApp.get("/data", (c) => c.json({ ok: true }));

      // First request in this window
      const r1 = await testApp.request("/data", {
        method: "GET",
        headers: { "x-forwarded-for": "50.50.50.50" },
      });
      expect(r1.status).toBe(200);

      // Set the stored entry to an old window to simulate time passing
      const oldWindow = Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
      middleware._store.ipCounters.set("50.50.50.50", { count: 1, windowStart: oldWindow });

      // Now the same IP should be allowed again (new window)
      const r2 = await testApp.request("/data", {
        method: "GET",
        headers: { "x-forwarded-for": "50.50.50.50" },
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

      // Should allow 60 requests without hitting IP limit
      const promises = Array.from({ length: 60 }, (_, i) =>
        app.request("/data", {
          method: "GET",
          headers: { "x-forwarded-for": "99.99.99.99" },
        }),
      );
      const results = await Promise.all(promises);
      results.forEach((res) => expect(res.status).toBe(200));

      // 61st should be blocked
      const blocked = await app.request("/data", {
        method: "GET",
        headers: { "x-forwarded-for": "99.99.99.99" },
      });
      expect(blocked.status).toBe(429);

      clearInterval(middleware._cleanup);
    });
  });

  describe("POST without Authorization header", () => {
    it("still applies IP limit but skips key limit", async () => {
      const app = buildApp(2, 1);

      // POST without auth header - only IP limit applies
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

      // Third request hits IP limit
      const res3 = await app.request("/data", {
        method: "POST",
        headers: { "x-forwarded-for": "20.20.20.20" },
      });
      expect(res3.status).toBe(429);
    });
  });
});
