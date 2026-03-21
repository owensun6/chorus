// Author: be-api-router
import type { Context, Next } from "hono";
import { errorResponse } from "../shared/response";

interface WindowEntry {
  readonly count: number;
  readonly windowStart: number;
}

interface RateLimitStore {
  readonly ipCounters: Map<string, WindowEntry>;
  readonly keyCounters: Map<string, WindowEntry>;
}

const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60_000;

const extractIp = (c: Context): string =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
  c.req.header("cf-connecting-ip") ??
  "unknown";

const extractApiKey = (c: Context): string | null => {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
};

const getCurrentWindow = (now: number): number =>
  Math.floor(now / WINDOW_MS) * WINDOW_MS;

const checkAndIncrement = (
  counters: Map<string, WindowEntry>,
  key: string,
  limit: number,
  now: number,
): boolean => {
  const window = getCurrentWindow(now);
  const existing = counters.get(key);

  if (!existing || existing.windowStart !== window) {
    counters.set(key, { count: 1, windowStart: window });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  counters.set(key, { count: existing.count + 1, windowStart: window });
  return true;
};

const purgeExpiredEntries = (counters: Map<string, WindowEntry>, now: number): void => {
  const currentWindow = getCurrentWindow(now);
  const keysToDelete: string[] = [];
  counters.forEach((entry, key) => {
    if (entry.windowStart < currentWindow) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => counters.delete(key));
};

const createRateLimitMiddleware = (
  ipLimitPerMin = 60,
  keyLimitPerMin = 120,
) => {
  const store: RateLimitStore = {
    ipCounters: new Map(),
    keyCounters: new Map(),
  };

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    purgeExpiredEntries(store.ipCounters, now);
    purgeExpiredEntries(store.keyCounters, now);
  }, CLEANUP_INTERVAL_MS);

  // Allow process to exit without waiting for cleanup timer
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }

  const middleware = async (c: Context, next: Next) => {
    const now = Date.now();
    const ip = extractIp(c);

    const ipAllowed = checkAndIncrement(store.ipCounters, ip, ipLimitPerMin, now);
    if (!ipAllowed) {
      return c.json(
        errorResponse("ERR_RATE_LIMITED", "Too many requests. Try again later."),
        429,
      );
    }

    const method = c.req.method.toUpperCase();
    if (method !== "GET") {
      const apiKey = extractApiKey(c);
      if (apiKey) {
        const keyAllowed = checkAndIncrement(store.keyCounters, apiKey, keyLimitPerMin, now);
        if (!keyAllowed) {
          return c.json(
            errorResponse("ERR_RATE_LIMITED", "Too many requests. Try again later."),
            429,
          );
        }
      }
    }

    return next();
  };

  const _purge = () => {
    const now = Date.now();
    purgeExpiredEntries(store.ipCounters, now);
    purgeExpiredEntries(store.keyCounters, now);
  };

  return Object.assign(middleware, {
    _store: store,
    _cleanup: cleanupTimer,
    _purge,
  });
};

export { createRateLimitMiddleware };
