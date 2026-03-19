// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const SENDER_AGENT = {
  id: "agent-alpha",
  endpoint: "https://alpha.example.com/a2a",
  card: {
    chorus_version: "0.2" as const,
    user_culture: "en-US",
    supported_languages: ["en"],
  },
};

const TARGET_AGENT = {
  id: "agent-beta",
  endpoint: "https://beta.example.com/a2a",
  card: {
    chorus_version: "0.2" as const,
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "en"],
  },
};

const validMessage = {
  sender_agent_id: SENDER_AGENT.id,
  target_agent_id: TARGET_AGENT.id,
  message: {
    role: "ROLE_USER",
    parts: [{ text: "Hello from alpha", mediaType: "text/plain" }],
  },
};

describe("POST /messages", () => {
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(SENDER_AGENT.id, SENDER_AGENT.endpoint, SENDER_AGENT.card);
    registry.register(TARGET_AGENT.id, TARGET_AGENT.endpoint, TARGET_AGENT.card);
    app = createApp(registry);

    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const postMessage = (body: unknown) =>
    app.request("/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  it("forwards message to target and wraps response (test_case_1)", async () => {
    const targetReply = { status: "ok", reply: "Nihao!" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(targetReply), { status: 200 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.target_response).toEqual(targetReply);
    expect(json.metadata.timestamp).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(TARGET_AGENT.endpoint);
    expect(opts?.method).toBe("POST");
    const sentBody = JSON.parse(opts?.body as string);
    expect(sentBody.sender_agent_id).toBe(SENDER_AGENT.id);
    expect(sentBody.message).toEqual(validMessage.message);
  });

  it("returns 400 when sender is not registered (test_case_2)", async () => {
    const body = { ...validMessage, sender_agent_id: "unknown-sender" };

    const res = await postMessage(body);

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_INVALID_BODY");
  });

  it("returns 404 when target is not registered (test_case_3)", async () => {
    const body = { ...validMessage, target_agent_id: "unknown-target" };

    const res = await postMessage(body);

    expect(res.status).toBe(404);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_NOT_FOUND");
  });

  it("returns 502 when target is unreachable (test_case_4)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await postMessage(validMessage);

    expect(res.status).toBe(502);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("returns 200 with target error when target returns 400 (test_case_5)", async () => {
    const targetError = { error: "bad request from target" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(targetError), { status: 400 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.target_response).toEqual(targetError);
  });

  it("message content is pure passthrough (test_case_6)", async () => {
    const customMessage = {
      role: "ROLE_USER",
      parts: [
        { text: "Do not modify me!", mediaType: "text/plain" },
        { data: { key: "value" }, mediaType: "application/json" },
      ],
      extensions: ["https://example.com/ext"],
    };
    const body = {
      ...validMessage,
      message: customMessage,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await postMessage(body);

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.message).toEqual(customMessage);
  });

  it("returns 502 when target returns 500 (server error)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(502);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request("/messages", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_INVALID_BODY");
  });

  it("returns 400 when message field is missing", async () => {
    const body = {
      sender_agent_id: SENDER_AGENT.id,
      target_agent_id: TARGET_AGENT.id,
    };

    const res = await postMessage(body);

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_INVALID_BODY");
  });
});

describe("Server entry point (test_case_7)", () => {
  it("exports a valid app from index", async () => {
    const { app } = await import("../../src/server/index");
    expect(app).toBeDefined();
  });
});
