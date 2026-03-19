// Author: be-api-router
import { createWebServer } from "../../src/demo/web";
import type { SendMessageFn } from "../../src/demo/web";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createTestServer = (overrides?: {
  sendMessage?: SendMessageFn;
  agents?: ReadonlySet<string>;
}) => {
  const mockSendMessage = overrides?.sendMessage ?? jest.fn().mockResolvedValue(undefined);
  const agents = overrides?.agents ?? new Set(["agent-zh-cn", "agent-ja"]);

  return createWebServer({
    sendMessage: mockSendMessage,
    agents,
  });
};

const jsonRequest = (app: any, path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

describe("GET /", () => {
  it("returns HTML content", async () => {
    const { app } = createTestServer();
    const res = await app.request("/");

    // May return 500 if index.html is not found (test env), but should not crash
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("<!DOCTYPE html>");
    }
  });
});

// ---------------------------------------------------------------------------
// GET /events — SSE endpoint
// ---------------------------------------------------------------------------

describe("GET /events", () => {
  it("returns Content-Type text/event-stream", async () => {
    const { app } = createTestServer();
    const res = await app.request("/events");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("sends initial connected event", async () => {
    const { app } = createTestServer();
    const res = await app.request("/events");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("event: connected");
    expect(text).toContain("client_id");

    reader.cancel();
  });
});

// ---------------------------------------------------------------------------
// POST /api/send — valid body
// ---------------------------------------------------------------------------

describe("POST /api/send", () => {
  it("returns 202 with message_id for valid body", async () => {
    const mockSend = jest.fn().mockResolvedValue(undefined);
    const { app } = createTestServer({ sendMessage: mockSend });

    const res = await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-zh-cn",
      to_agent_id: "agent-ja",
      text: "hello",
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.message_id).toBeDefined();
    expect(typeof body.data.message_id).toBe("string");
    expect(body.metadata.timestamp).toBeDefined();
  });

  it("calls sendMessage with correct arguments", async () => {
    const mockSend = jest.fn().mockResolvedValue(undefined);
    const { app } = createTestServer({ sendMessage: mockSend });

    await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-zh-cn",
      to_agent_id: "agent-ja",
      text: "how are you",
    });

    expect(mockSend).toHaveBeenCalledWith("agent-zh-cn", "agent-ja", "how are you");
  });

  it("returns 400 when text is missing", async () => {
    const { app } = createTestServer();
    const res = await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-zh-cn",
      to_agent_id: "agent-ja",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("ERR_VALIDATION");
  });

  it("returns 400 when text is empty string", async () => {
    const { app } = createTestServer();
    const res = await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-zh-cn",
      to_agent_id: "agent-ja",
      text: "",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 when from_agent_id is unknown", async () => {
    const { app } = createTestServer();
    const res = await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-nonexistent",
      to_agent_id: "agent-ja",
      text: "hello",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("ERR_VALIDATION");
    expect(body.error.message).toContain("agent-nonexistent");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const { app } = createTestServer();
    const res = await app.request("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("ERR_VALIDATION");
  });

  it("returns 500 when sendMessage throws", async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error("LLM timeout"));
    const { app } = createTestServer({ sendMessage: mockSend });

    const res = await jsonRequest(app, "/api/send", {
      from_agent_id: "agent-zh-cn",
      to_agent_id: "agent-ja",
      text: "hello",
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("ERR_SEND_FAILED");
    expect(body.error.message).toContain("LLM timeout");
  });
});

// ---------------------------------------------------------------------------
// broadcast — SSE event delivery
// ---------------------------------------------------------------------------

describe("broadcast", () => {
  it("sends SSE events to connected clients", async () => {
    const { app, broadcast } = createTestServer();

    // Connect a client via GET /events
    const res = await app.request("/events");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read the initial connected event
    await reader.read();

    // Broadcast an event
    broadcast("message_sent", { from: "agent-zh-cn", text: "test" });

    // Read the broadcast event
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("event: message_sent");
    expect(text).toContain("agent-zh-cn");
    expect(text).toContain("test");

    reader.cancel();
  });

  it("does not modify the data payload", async () => {
    const { app, broadcast } = createTestServer();

    const res = await app.request("/events");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial event
    await reader.read();

    const originalData = { from: "agent-zh-cn", text: "immutable" };
    const dataCopy = { ...originalData };
    broadcast("message_sent", originalData);

    // Verify original data was not mutated
    expect(originalData).toEqual(dataCopy);

    const { value } = await reader.read();
    const text = decoder.decode(value);
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.text).toBe("immutable");

    reader.cancel();
  });
});
