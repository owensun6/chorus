// Author: be-domain-modeler
// Shared helpers for load testing the Chorus Hub

const HUB_URL = process.env["HUB_URL"] ?? "http://localhost:3000";
const IS_LOCAL_HUB = /localhost|127\.0\.0\.1/.test(HUB_URL);
const APP_API_KEY = process.env["APP_API_KEY"] ?? null;
const HEALTH_RETRIES = parseInt(process.env["HEALTH_RETRIES"] ?? "5", 10);
const HEALTH_RETRY_DELAY_MS = parseInt(process.env["HEALTH_RETRY_DELAY_MS"] ?? "1000", 10);
const REGISTER_DELAY_MS = parseInt(
  process.env["REGISTER_DELAY_MS"] ?? (IS_LOCAL_HUB ? "0" : "1100"),
  10,
);

const NETWORK_RETRIES = 3;
const NETWORK_RETRY_DELAY_MS = 2000;

const withNetworkRetry = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient = err instanceof TypeError && String(err).includes("fetch failed");
      if (!isTransient || attempt === NETWORK_RETRIES) throw err;
      console.warn(`  ⚠ ${label} attempt ${attempt} failed (retrying in ${NETWORK_RETRY_DELAY_MS}ms): ${err}`);
      await sleep(NETWORK_RETRY_DELAY_MS);
    }
  }
  throw new Error("unreachable");
};

let lastRegistrationAt = 0;

interface Agent {
  readonly id: string;
  readonly apiKey: string;
}

interface SendResult {
  readonly ok: boolean;
  readonly status: number;
  readonly latencyMs: number;
  readonly body?: unknown;
}

interface SSEConnection {
  readonly agentId: string;
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly abort: () => void;
  disconnected: boolean;
  messageCount: number;
}

const sleepForRateLimit = async (): Promise<void> => {
  if (REGISTER_DELAY_MS <= 0) return;

  const now = Date.now();
  const waitMs = Math.max(0, lastRegistrationAt + REGISTER_DELAY_MS - now);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRegistrationAt = Date.now();
};

const sharedAgentId = (index: number): string => `loadtest-a${index}@test`;

const deleteAgentId = async (id: string): Promise<boolean> => {
  if (!APP_API_KEY) return false;

  const res = await fetch(`${HUB_URL}/agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${APP_API_KEY}` },
  });

  return res.ok || res.status === 404;
};

const registerAgentId = async (
  id: string,
  endpoint?: string,
): Promise<Agent> => {
  const registerOnce = async (): Promise<Response> => {
    await sleepForRateLimit();
    return fetch(`${HUB_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: id,
        agent_card: {
          card_version: "0.3",
          user_culture: "en",
          supported_languages: ["en"],
          agent_description: "load test agent",
        },
        ...(endpoint ? { endpoint } : {}),
      }),
    });
  };

  return withNetworkRetry(`register ${id}`, async () => {
    let res = await registerOnce();
    if (res.status === 409 && APP_API_KEY) {
      const deleted = await deleteAgentId(id);
      if (!deleted) {
        const body = await res.text().catch(() => "");
        throw new Error(`Register failed for ${id}: ${res.status} ${body}`);
      }
      res = await registerOnce();
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Register failed for ${id}: ${res.status} ${body}`);
    }

    const body = (await res.json()) as { data: { api_key: string } };
    return { id, apiKey: body.data.api_key };
  });
};

const registerAgent = async (suffix: number | string): Promise<Agent> =>
  registerAgentId(`loadtest-${suffix}@test`);

const connectInbox = async (agent: Agent): Promise<SSEConnection> =>
  withNetworkRetry(`inbox ${agent.id}`, async () => {
    const controller = new AbortController();
    const res = await fetch(`${HUB_URL}/agent/inbox?token=${agent.apiKey}`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    });

    if (!res.ok || !res.body) {
      throw new Error(`Inbox connect failed for ${agent.id}: ${res.status}`);
    }

    const reader = res.body.getReader();
    const conn: SSEConnection = {
      agentId: agent.id,
      reader,
      abort: () => controller.abort(),
      disconnected: false,
      messageCount: 0,
    };

    return conn;
  });

const drainSSE = (conn: SSEConnection): void => {
  (async () => {
    try {
      for (;;) {
        const { done } = await conn.reader.read();
        if (done) { conn.disconnected = true; break; }
        conn.messageCount++;
      }
    } catch {
      conn.disconnected = true;
    }
  })();
};

const sendMessage = async (
  sender: Agent,
  receiverId: string,
  text: string,
): Promise<SendResult> => {
  const start = performance.now();
  try {
    const res = await fetch(`${HUB_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sender.apiKey}`,
      },
      body: JSON.stringify({
        receiver_id: receiverId,
        envelope: {
          chorus_version: "0.4",
          sender_id: sender.id,
          sender_culture: "en",
          original_text: text,
        },
      }),
    });
    const latencyMs = performance.now() - start;
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, latencyMs, body };
  } catch (err) {
    const latencyMs = performance.now() - start;
    return { ok: false, status: 0, latencyMs, body: String(err) };
  }
};

const fetchHealth = async (): Promise<Record<string, unknown>> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= HEALTH_RETRIES; attempt++) {
    try {
      const res = await fetch(`${HUB_URL}/health`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`health ${res.status} ${text}`.trim());
      }

      const text = await res.text();
      const body = JSON.parse(text) as { data?: Record<string, unknown> };
      if (!body.data) {
        throw new Error("health response missing data");
      }
      return body.data;
    } catch (err) {
      lastError = err;
      if (attempt < HEALTH_RETRIES) {
        await sleep(HEALTH_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`health fetch failed after ${HEALTH_RETRIES} attempts`);
};

const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

export {
  HUB_URL,
  IS_LOCAL_HUB,
  REGISTER_DELAY_MS,
  APP_API_KEY,
  HEALTH_RETRIES,
  HEALTH_RETRY_DELAY_MS,
  registerAgent,
  registerAgentId,
  deleteAgentId,
  sharedAgentId,
  connectInbox,
  drainSSE,
  sendMessage,
  fetchHealth,
  percentile,
  sleep,
  formatBytes,
};
export type { Agent, SSEConnection, SendResult };
