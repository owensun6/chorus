import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const makeTempHome = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "chorus-runtime-v2-"));
const originalExistsSync = fs.existsSync.bind(fs);
const activationProofPathFor = (home: string, agentId: string): string =>
  path.join(home, ".chorus", "state", agentId.split("@")[0], `activation-proof.${agentId}.json`);

describe("runtime-v2 plugin entry", () => {
  let fakeHome: string;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fakeHome = makeTempHome();
  });

  afterEach(() => {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  const seedBundledRuntime = (): void => {
    const runtimeDir = path.join(fakeHome, ".openclaw", "extensions", "chorus-bridge", "runtime");
    fs.mkdirSync(runtimeDir, { recursive: true });
    // Write a minimal state.ts so resolveRuntimeDir detects the bundled path
    fs.writeFileSync(path.join(runtimeDir, "state.ts"), "// stub", "utf-8");
  };

  const seedAgentConfig = (): void => {
    fs.mkdirSync(path.join(fakeHome, ".chorus", "agents"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".chorus", "agents", "xiaov.json"),
      JSON.stringify({
        agent_id: "xiaov@openclaw",
        api_key: "test-key",
        hub_url: "https://hub.example",
        culture: "zh-CN",
        preferred_language: "zh-CN",
      }),
      "utf-8",
    );
  };

  const seedTelegramRuntimeMultiAccount = (agentName: string): void => {
    fs.mkdirSync(path.join(fakeHome, ".openclaw", "agents", agentName, "sessions"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".openclaw", "agents", agentName, "sessions", "sessions.json"),
      JSON.stringify({
        [`agent:${agentName}:main`]: {
          deliveryContext: {
            channel: "telegram",
            to: "telegram:123456",
            accountId: "tg-main",
          },
        },
      }),
      "utf-8",
    );
  };

  // Alias for backward compat with existing tests
  const seedTelegramRuntime = seedTelegramRuntimeMultiAccount;

  const seedTelegramRuntimeDefaultOnly = (agentName: string): void => {
    fs.mkdirSync(path.join(fakeHome, ".openclaw", "agents", agentName, "sessions"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".openclaw", "agents", agentName, "sessions", "sessions.json"),
      JSON.stringify({
        [`agent:${agentName}:main`]: {
          deliveryContext: {
            channel: "telegram",
            to: "telegram:789012",
            accountId: "default",
          },
        },
      }),
      "utf-8",
    );
  };

  // Fallback: OpenClaw agent dir name differs from Chorus agent name
  const seedTelegramRuntimeFallback = (openclawAgentName: string): void => {
    fs.mkdirSync(path.join(fakeHome, ".openclaw", "agents", openclawAgentName, "sessions"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".openclaw", "agents", openclawAgentName, "sessions", "sessions.json"),
      JSON.stringify({
        [`agent:${openclawAgentName}:main`]: {
          deliveryContext: {
            channel: "telegram",
            to: "telegram:789012",
            accountId: "default",
          },
        },
      }),
      "utf-8",
    );
  };

  const seedDurableState = (): void => {
    const stateDir = path.join(fakeHome, ".chorus", "state", "xiaov");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "xiaov@openclaw.json"),
      JSON.stringify({
        schema_version: "2.0",
        agent_id: "xiaov@openclaw",
        cursor: {
          last_completed_trace_id: null,
          last_completed_timestamp: null,
        },
        continuity: {
          "xiaov@openclaw:older@chorus": {
            remote_peer_id: "older@chorus",
            local_anchor_id: "agent:xiaov:main",
            conversation_id: "conv-older",
            last_inbound_turn: 9,
            last_outbound_turn: 4,
            created_at: "2026-03-25T09:00:00.000Z",
            updated_at: "2026-03-25T09:30:00.000Z",
          },
          "xiaov@openclaw:xiaox@chorus": {
            remote_peer_id: "xiaox@chorus",
            local_anchor_id: "agent:xiaov:main",
            conversation_id: "conv-42",
            last_inbound_turn: 1,
            last_outbound_turn: 0,
            created_at: "2026-03-25T10:00:00.000Z",
            updated_at: "2026-03-25T10:05:00.000Z",
          },
          "xiaov@openclaw:wrong-anchor@chorus": {
            remote_peer_id: "wrong-anchor@chorus",
            local_anchor_id: "agent:xiaov:other",
            conversation_id: "conv-wrong",
            last_inbound_turn: 3,
            last_outbound_turn: 2,
            created_at: "2026-03-25T10:10:00.000Z",
            updated_at: "2026-03-25T10:10:00.000Z",
          },
          "xiaov@openclaw:xiaov@openclaw": {
            remote_peer_id: "xiaov@openclaw",
            local_anchor_id: "agent:xiaov:main",
            conversation_id: "conv-self",
            last_inbound_turn: 7,
            last_outbound_turn: 7,
            created_at: "2026-03-25T10:11:00.000Z",
            updated_at: "2026-03-25T10:11:00.000Z",
          },
        },
        inbound_facts: {
          "trace-older": {
            route_key: "xiaov@openclaw:older@chorus",
            observed_at: "2026-03-25T09:20:00.000Z",
            hub_timestamp: "2026-03-25T09:20:00.000Z",
            envelope_projection: {
              original_text: "Older route message",
              sender_culture: "en",
              cultural_context: null,
              conversation_id: "conv-older",
              turn_number: 9,
            },
            dedupe_result: "new",
            delivery_evidence: null,
            terminal_disposition: null,
            cursor_advanced: true,
          },
          "trace-old": {
            route_key: "xiaov@openclaw:xiaox@chorus",
            observed_at: "2026-03-25T10:01:00.000Z",
            hub_timestamp: "2026-03-25T10:01:00.000Z",
            envelope_projection: {
              original_text: "Old remote message",
              sender_culture: "en",
              cultural_context: null,
              conversation_id: "conv-42",
              turn_number: 1,
            },
            dedupe_result: "new",
            delivery_evidence: null,
            terminal_disposition: null,
            cursor_advanced: true,
          },
          "trace-new": {
            route_key: "xiaov@openclaw:xiaox@chorus",
            observed_at: "2026-03-25T10:06:00.000Z",
            hub_timestamp: "2026-03-25T10:06:00.000Z",
            envelope_projection: {
              original_text: "Most recent remote message from Chorus durable state",
              sender_culture: "en",
              cultural_context: null,
              conversation_id: "conv-42",
              turn_number: 2,
            },
            dedupe_result: "new",
            delivery_evidence: null,
            terminal_disposition: null,
            cursor_advanced: true,
          },
          "trace-self": {
            route_key: "xiaov@openclaw:xiaov@openclaw",
            observed_at: "2026-03-25T10:11:00.000Z",
            hub_timestamp: "2026-03-25T10:11:00.000Z",
            envelope_projection: {
              original_text: "Latest self-route noise that must never win continuation binding",
              sender_culture: "zh-CN",
              cultural_context: null,
              conversation_id: "conv-self",
              turn_number: 7,
            },
            dedupe_result: "new",
            delivery_evidence: null,
            terminal_disposition: null,
            cursor_advanced: true,
          },
        },
        relay_evidence: {
          "outbound-older": {
            inbound_trace_id: "trace-older",
            route_key: "xiaov@openclaw:older@chorus",
            reply_text: "Older route reply",
            bound_turn_number: 4,
            idempotency_key: "relay:test:outbound-older",
            submitted_at: "2026-03-25T09:25:00.000Z",
            hub_trace_id: "hub-trace-older",
            confirmed: true,
          },
          "outbound-1": {
            inbound_trace_id: "trace-new",
            route_key: "xiaov@openclaw:xiaox@chorus",
            reply_text: "I replied from durable state too.",
            bound_turn_number: 3,
            idempotency_key: "relay:test:outbound-1",
            submitted_at: "2026-03-25T10:07:00.000Z",
            hub_trace_id: "hub-trace-1",
            confirmed: true,
          },
          "outbound-self": {
            inbound_trace_id: "trace-self",
            route_key: "xiaov@openclaw:xiaov@openclaw",
            reply_text: "Self-route reply that must stay invisible to continuation routing.",
            bound_turn_number: 8,
            idempotency_key: "relay:test:outbound-self",
            submitted_at: "2026-03-25T10:11:30.000Z",
            hub_trace_id: "hub-trace-self",
            confirmed: true,
          },
        },
      }),
      "utf-8",
    );
  };

  const buildFakeApi = () => {
    const hooks = new Map<string, Function>();
    return {
      hooks,
      api: {
        config: {},
        runtime: { channel: {} },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        on: jest.fn((name: string, handler: Function) => {
          hooks.set(name, handler);
        }),
      },
    };
  };

  const installMocks = (recoverMock?: jest.Mock) => {
    // Seed bundled runtime directory so resolveRuntimeDir() finds it
    seedBundledRuntime();

    jest.doMock("node:fs", () => {
      const realFs = jest.requireActual("node:fs") as typeof fs;
      return {
        ...realFs,
        existsSync: (target: fs.PathLike) => {
          const p = String(target);
          if (
            p.includes("/node_modules/openclaw/node_modules/jiti/lib/jiti.mjs") ||
            p.includes("/dist/plugin-sdk/root-alias.cjs")
          ) {
            return false;
          }
          return originalExistsSync(target);
        },
      };
    });

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const recover = recoverMock ?? jest.fn().mockResolvedValue({});
    const outboundInstances: Array<{
      relayReply: jest.Mock;
      bindReply: jest.Mock;
      submitRelay: jest.Mock;
      confirmRelay: jest.Mock;
    }> = [];
    const hubClientInstances: Array<{
      fetchHistory: jest.Mock;
      submitRelay: jest.Mock;
      connectSSE: jest.Mock;
      disconnect: jest.Mock;
    }> = [];
    const recoveryConfigs: unknown[] = [];

    class FakeDurableStateManager {
      constructor(_stateDir: string, _agentId: string) {}
    }
    class FakeInboundPipeline {
      processMessage = jest.fn().mockResolvedValue(undefined);
      constructor(_stateManager: unknown, _hostAdapter: unknown, _config: unknown, _onError?: unknown) {}
    }
    class FakeOutboundPipeline {
      bindReply = jest.fn().mockReturnValue("out-1");
      submitRelay = jest.fn().mockResolvedValue({ trace_id: "hub-trace-1" });
      confirmRelay = jest.fn().mockResolvedValue(undefined);
      relayReply = jest.fn().mockImplementation(async (
        routeKey: string,
        replyText: string,
        inboundTraceId: string | null,
        hubClient: unknown,
        apiKey: string,
      ) => {
        const outboundId = this.bindReply(routeKey, replyText, inboundTraceId);
        const result = await this.submitRelay(outboundId, hubClient, apiKey);
        await this.confirmRelay(outboundId, result.trace_id);
        return result;
      });
      constructor(_stateManager: unknown, _config: unknown) {
        outboundInstances.push(this);
      }
    }
    class FakeRecoveryEngine {
      recover = recover;
      constructor(config: unknown, _onError?: unknown) {
        recoveryConfigs.push(config);
      }
    }
    class FakeHubClient {
      fetchHistory = jest.fn().mockResolvedValue([]);
      submitRelay = jest.fn().mockResolvedValue({ trace_id: "hub-trace-1" });
      connectSSE = jest.fn();
      disconnect = jest.fn();
      constructor(_hubUrl: string, _config?: unknown) {
        hubClientInstances.push(this);
      }
    }

    jest.doMock("jiti", () => ({
      createJiti: () => ({
        import: async (specifier: string) => {
          // Match both bundled runtime/ paths and dev src/bridge/ paths
          if (specifier.endsWith("/state.ts")) {
            return { DurableStateManager: FakeDurableStateManager };
          }
          if (specifier.endsWith("/inbound.ts")) {
            return { InboundPipeline: FakeInboundPipeline };
          }
          if (specifier.endsWith("/outbound.ts")) {
            return { OutboundPipeline: FakeOutboundPipeline };
          }
          if (specifier.endsWith("/recovery.ts")) {
            return { RecoveryEngine: FakeRecoveryEngine };
          }
          if (specifier.endsWith("/hub-client.ts")) {
            return { HubClient: FakeHubClient };
          }
          throw new Error(`unexpected import: ${specifier}`);
        },
      }),
    }), { virtual: true });

    return { recover, outboundInstances, hubClientInstances, recoveryConfigs };
  };

  it("before_prompt_build does not inject continuity when sessionKey is missing", async () => {
    seedAgentConfig();
    seedDurableState();
    installMocks();
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const hook = hooks.get("before_prompt_build");
    expect(hook).toBeDefined();

    const injection = hook?.(
      { messages: [{ role: "user", content: "继续跟小x聊" }] },
      { agentId: "xiaov@openclaw" },
    );

    expect(injection).toBeUndefined();
  });

  it("before_prompt_build injects continuity only when durable state anchor matches sessionKey", async () => {
    seedAgentConfig();
    seedDurableState();
    installMocks();
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const hook = hooks.get("before_prompt_build");
    const injection = hook?.(
      { messages: [{ role: "user", content: "继续跟小x聊" }] },
      { agentId: "xiaov@openclaw", sessionKey: "agent:xiaov:main" },
    );

    expect(injection).toBeDefined();
    expect(injection.prependSystemContext).toContain("xiaox@chorus");
    expect(injection.prependSystemContext).toContain("conv-42");
    expect(injection.prependSystemContext).toContain("Most recent remote message from Chorus durable state");
    expect(injection.prependSystemContext).toContain("I replied from durable state too.");
    expect(injection.prependSystemContext).not.toContain("Latest self-route noise");
    expect(injection.prependSystemContext).not.toContain("Self-route reply");
    expect(injection.prependSystemContext).not.toContain("Older route message");
    expect(injection.prependSystemContext).not.toContain("Older route reply");
  });

  it("before_prompt_build resolves durable state when hookCtx.agentId is bare short name", async () => {
    seedAgentConfig();
    seedDurableState();
    installMocks();
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const hook = hooks.get("before_prompt_build");
    const injection = hook?.(
      { messages: [{ role: "user", content: "她刚才说了什么？" }] },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    expect(injection).toBeDefined();
    expect(injection.prependSystemContext).toContain("xiaox@chorus");
    expect(injection.prependSystemContext).toContain("Most recent remote message from Chorus durable state");
    expect(injection.prependSystemContext).toContain("I replied from durable state too.");
    expect(injection.prependSystemContext).not.toContain("Latest self-route noise");
    expect(injection.prependSystemContext).not.toContain("Self-route reply");
  });

  it("gateway_start wires index.ts to runtime-v2 recovery engine", async () => {
    seedAgentConfig();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const indexRegister = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    const runtimeRegister = (await import("../../packages/chorus-skill/templates/bridge/runtime-v2")).default;

    expect(indexRegister).toBe(runtimeRegister);

    indexRegister(api);
    const gatewayStart = hooks.get("gateway_start");
    expect(gatewayStart).toBeDefined();

    await gatewayStart?.();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover.mock.calls[0]).toHaveLength(6);
  });

  it("gateway_start injects catchup timeout at fetchHistory and lowers retries for live fail-closed proof", async () => {
    seedAgentConfig();
    fs.mkdirSync(path.join(fakeHome, ".chorus", "debug"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".chorus", "debug", "hub-catchup-timeout.json"),
      JSON.stringify({
        enabled: true,
        agent: "xiaov",
        timeout_ms: 1,
        max_retries: 0,
      }),
      "utf-8",
    );

    const recoverMock = jest.fn().mockImplementation(async (
      _stateManager: unknown,
      _inboundPipeline: unknown,
      _outboundPipeline: unknown,
      hubClient: { fetchHistory: (apiKey: string) => Promise<unknown> },
    ) => {
      await expect(hubClient.fetchHistory("test-key")).rejects.toThrow(
        "Injected Hub catchup timeout after 1ms",
      );
      return {};
    });
    const { hubClientInstances, recoveryConfigs } = installMocks(recoverMock);
    const { api, hooks } = buildFakeApi();

    jest.useFakeTimers();
    try {
      const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
      register(api);

      const gatewayStart = hooks.get("gateway_start");
      const startPromise = gatewayStart?.();
      await jest.advanceTimersByTimeAsync(1);
      await startPromise;
    } finally {
      jest.useRealTimers();
    }

    expect(hubClientInstances).toHaveLength(1);
    expect(recoverMock).toHaveBeenCalledTimes(1);
    expect(recoveryConfigs).toHaveLength(1);
    expect(recoveryConfigs[0]).toMatchObject({
      agentId: "xiaov@openclaw",
      apiKey: "test-key",
      maxCatchupRetries: 0,
    });
    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[catchup-timeout] injecting fetchHistory timeout timeoutMs=1"),
    );
    expect(fs.existsSync(path.join(fakeHome, ".chorus", "debug", "hub-catchup-timeout.json"))).toBe(false);
  });

  it("OpenClawHostAdapter rethrows pre-send delivery errors so inbound stays retryable", async () => {
    seedTelegramRuntime("xiaox");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "debug"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".chorus", "debug", "host-timeout.json"),
      JSON.stringify({
        enabled: true,
        agent: "xiaox",
        channel: "telegram",
        trace_id: "trace-throw-before-send",
        mode: "throw_before_send",
      }),
      "utf-8",
    );

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    let dispatcherDeliver: ((payload: { text?: string }) => Promise<void>) | null = null;
    let dispatcherOnError: ((err: unknown) => void) | null = null;

    const fakeApi = {
      config: { channels: { telegram: { enabled: true } } },
      runtime: {
        channel: {
          routing: {
            resolveAgentRoute: jest.fn().mockReturnValue({ agentId: "agent:xiaox:main" }),
          },
          telegram: {
            sendMessageTelegram: jest.fn().mockResolvedValue({ messageId: "99999", chatId: "123456" }),
          },
          session: {
            resolveStorePath: jest.fn().mockReturnValue(path.join(fakeHome, "session-store.json")),
            recordInboundSession: jest.fn().mockResolvedValue(undefined),
          },
          reply: {
            finalizeInboundContext: jest.fn((ctx: unknown) => ctx),
            resolveHumanDelayConfig: jest.fn().mockReturnValue({}),
            createReplyDispatcherWithTyping: jest.fn((params: { deliver: (payload: { text?: string }) => Promise<void>; onError: (err: unknown) => void }) => {
              dispatcherDeliver = params.deliver;
              dispatcherOnError = params.onError;
              return {
                dispatcher: {},
                replyOptions: {},
                markDispatchIdle: jest.fn(),
              };
            }),
            withReplyDispatcher: jest.fn(async ({ run }: { run: () => Promise<void> }) => {
              try {
                await run();
              } catch (err) {
                dispatcherOnError?.(err);
              }
            }),
            dispatchReplyFromConfig: jest.fn(async () => {
              await dispatcherDeliver?.({ text: "本地用户可见\n[chorus_reply]\n远端回复" });
            }),
          },
        },
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "xiaox@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "zh-CN",
          preferred_language: "zh-CN",
        },
        name: "xiaox",
        stateDir: path.join(fakeHome, ".chorus", "state", "xiaox"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    jest.useFakeTimers();
    try {
      await expect(adapter.deliverInbound({
        route_key: "xiaox@chorus:xiaov@openclaw",
        local_anchor_id: "agent:xiaox:main",
        adapted_content: "S0310 runtime throw-before-send",
        metadata: {
          sender_id: "xiaov@openclaw",
          sender_culture: "zh-CN",
          cultural_context: null,
          conversation_id: "conv-throw",
          turn_number: 1,
          trace_id: "trace-throw-before-send",
        },
      })).rejects.toThrow("Injected transient delivery failure before send trace_id=trace-throw-before-send");

      await jest.runOnlyPendingTimersAsync();
    } finally {
      jest.useRealTimers();
    }

    expect(fakeApi.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("deliver error: Error: Injected transient delivery failure before send trace_id=trace-throw-before-send"),
    );
    expect(fs.existsSync(path.join(fakeHome, ".chorus", "debug", "host-timeout.json"))).toBe(false);
  });

  it("agent_end relays main-session continuation through the active durable-state route", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    expect(outboundInstances).toHaveLength(1);
    const outbound = outboundInstances[0];

    const beforePromptBuild = hooks.get("before_prompt_build");
    beforePromptBuild?.(
      {
        messages: [
          { role: "user", content: [{ type: "text", text: "继续跟小x聊，告诉她桥现在正常。" }] },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    const agentEnd = hooks.get("agent_end");
    expect(agentEnd).toBeDefined();

    agentEnd?.(
      {
        messages: [
          { role: "user", content: [{ type: "text", text: "继续跟小x聊，告诉她桥现在正常。" }] },
          { role: "assistant", content: [{ type: "text", text: "桥现在正常。"}] },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).toHaveBeenCalledWith(
      "xiaov@openclaw:xiaox@chorus",
      "桥现在正常。",
      null,
    );
    expect(outbound.submitRelay).toHaveBeenCalledTimes(1);
    expect(outbound.confirmRelay).toHaveBeenCalledWith("out-1", "hub-trace-1");
  });

  it("agent_end fail-closes continuation turns that try to use tools for manual send", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    const outbound = outboundInstances[0];
    const agentEnd = hooks.get("agent_end");
    expect(agentEnd).toBeDefined();

    const beforePromptBuild = hooks.get("before_prompt_build");
    beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：桥现在正常。只回复她，不要解释。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：桥现在正常。只回复她，不要解释。" }],
          },
          {
            role: "assistant",
            content: [{ type: "toolCall", id: "tool-1", name: "exec", arguments: { command: "curl ..." } }],
          },
          {
            role: "toolResult",
            content: [{ type: "text", text: "{\"success\":true}" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "发过去了。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).not.toHaveBeenCalled();
    expect(outbound.submitRelay).not.toHaveBeenCalled();
    expect(outbound.confirmRelay).not.toHaveBeenCalled();
  });

  it("agent_end skips tool-used continuation turns when no explicit remote body can be derived", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    const outbound = outboundInstances[0];
    const agentEnd = hooks.get("agent_end");

    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊" }],
          },
          {
            role: "assistant",
            content: [{ type: "toolCall", id: "tool-1", name: "exec", arguments: { command: "curl ..." } }],
          },
          {
            role: "toolResult",
            content: [{ type: "text", text: "{\"success\":true}" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "发过去了。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).not.toHaveBeenCalled();
    expect(outbound.submitRelay).not.toHaveBeenCalled();
    expect(outbound.confirmRelay).not.toHaveBeenCalled();
  });

  it("agent_end keeps the cached remote route when the same anchor also has a newer self-route", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    const outbound = outboundInstances[0];
    const beforePromptBuild = hooks.get("before_prompt_build");
    const agentEnd = hooks.get("agent_end");

    const injection = beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：继续保持在线。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    expect(injection).toBeDefined();
    expect(injection.prependSystemContext).toContain("xiaox@chorus");
    expect(injection.prependSystemContext).not.toContain("Self-route reply");

    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：继续保持在线。" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "继续保持在线。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).toHaveBeenCalledWith(
      "xiaov@openclaw:xiaox@chorus",
      "继续保持在线。",
      null,
    );
    expect(outbound.submitRelay).toHaveBeenCalledTimes(1);
    expect(outbound.confirmRelay).toHaveBeenCalledWith("out-1", "hub-trace-1");
  });

  it("agent_end does not leak a blocked turn's explicit body into the next clean continuation turn", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    const outbound = outboundInstances[0];
    const beforePromptBuild = hooks.get("before_prompt_build");
    const agentEnd = hooks.get("agent_end");

    beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：旧正文。不要调用任何工具，不要手工发送。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：旧正文。不要调用任何工具，不要手工发送。" }],
          },
          {
            role: "assistant",
            content: [{ type: "toolCall", id: "tool-1", name: "exec", arguments: { command: "curl ..." } }],
          },
          {
            role: "toolResult",
            content: [{ type: "text", text: "{\"success\":true}" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "发过去了。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).not.toHaveBeenCalled();

    beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊。不要调用任何工具，不要手工发送。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊。不要调用任何工具，不要手工发送。" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "新正文。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).toHaveBeenCalledTimes(1);
    expect(outbound.bindReply).toHaveBeenLastCalledWith(
      "xiaov@openclaw:xiaox@chorus",
      "新正文。",
      null,
    );
    expect(outbound.submitRelay).toHaveBeenCalledTimes(1);
    expect(outbound.confirmRelay).toHaveBeenCalledWith("out-1", "hub-trace-1");
  });

  it("agent_end derives explicit continuation body from the current turn instead of reusing a prior turn body", async () => {
    seedAgentConfig();
    seedDurableState();
    const { outboundInstances } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    const outbound = outboundInstances[0];
    const beforePromptBuild = hooks.get("before_prompt_build");
    const agentEnd = hooks.get("agent_end");

    beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：第一句。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );
    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：第一句。" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "第一句。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    beforePromptBuild?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：第二句。不要调用任何工具，不要手工发送。" }],
          },
        ],
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );
    agentEnd?.(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "继续跟小x聊，告诉她：第二句。不要调用任何工具，不要手工发送。" }],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "第二句。" }],
          },
        ],
        success: true,
      },
      { agentId: "xiaov", sessionKey: "agent:xiaov:main" },
    );

    await Promise.resolve();

    expect(outbound.bindReply).toHaveBeenNthCalledWith(
      1,
      "xiaov@openclaw:xiaox@chorus",
      "第一句。",
      null,
    );
    expect(outbound.bindReply).toHaveBeenNthCalledWith(
      2,
      "xiaov@openclaw:xiaox@chorus",
      "第二句。",
      null,
    );
  });

  const buildTelegramDeliveryHarness = () => {
    let capturedDeliver: ((payload: { text?: string }) => Promise<void>) | null = null;
    let capturedOnError: ((err: unknown) => void) | null = null;

    const fakeApi = {
      // No botToken here — plugin config does not carry channel credentials.
      // Tests that need token resolution must rely on global openclaw.json (seeded by helpers).
      config: { channels: { telegram: { enabled: true } } },
      runtime: {
        channel: {
          routing: {
            resolveAgentRoute: jest.fn().mockReturnValue({ agentId: "agent:xiaox:main" }),
          },
          telegram: {
            sendMessageTelegram: jest.fn().mockResolvedValue({ messageId: "98765", chatId: "123456" }),
          },
          session: {
            resolveStorePath: jest.fn().mockReturnValue(path.join(fakeHome, "session-store.json")),
            recordInboundSession: jest.fn().mockResolvedValue(undefined),
          },
          reply: {
            finalizeInboundContext: jest.fn((ctx: unknown) => ctx),
            resolveHumanDelayConfig: jest.fn().mockReturnValue({}),
            createReplyDispatcherWithTyping: jest.fn((params: { deliver: (payload: { text?: string }) => Promise<void>; onError: (err: unknown) => void }) => {
              capturedDeliver = params.deliver;
              capturedOnError = params.onError;
              return {
                dispatcher: {},
                replyOptions: {},
                markDispatchIdle: jest.fn(),
              };
            }),
            withReplyDispatcher: jest.fn(async ({ run }: { run: () => Promise<void> }) => {
              try {
                await run();
              } catch (err) {
                capturedOnError?.(err);
              }
            }),
            dispatchReplyFromConfig: jest.fn(async () => {
              await capturedDeliver?.({ text: "本地用户可见\n[chorus_reply]\n远端回复" });
            }),
          },
        },
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    return fakeApi;
  };

  const deliverInboundParams = {
    route_key: "xiaox@chorus:xiaov@openclaw",
    local_anchor_id: "agent:xiaox:main",
    adapted_content: "Telegram delivery test message",
    metadata: {
      sender_id: "xiaov@openclaw",
      sender_culture: "zh-CN",
      cultural_context: null,
      conversation_id: "conv-tg-test",
      turn_number: 1,
      trace_id: "trace-tg-ack",
    },
  };

  it("Telegram delivery returns confirmed with message_id ref when official helper succeeds", async () => {
    seedTelegramRuntime("xiaox");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results"), { recursive: true });

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    const fakeApi = buildTelegramDeliveryHarness();
    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "xiaox@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "zh-CN",
          preferred_language: "zh-CN",
        },
        name: "xiaox",
        stateDir: path.join(fakeHome, ".chorus", "state", "xiaox"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    const receipt = await adapter.deliverInbound(deliverInboundParams);

    expect(receipt.status).toBe("confirmed");
    expect(receipt.method).toBe("telegram_server_ack");
    expect(receipt.ref).toBe("98765");

    const deliveryFile = path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results", "trace-tg-ack.json");
    const deliveryRecord = JSON.parse(fs.readFileSync(deliveryFile, "utf-8"));
    expect(deliveryRecord.status).toBe("confirmed");
    expect(deliveryRecord.terminal_disposition).toBe("delivery_confirmed");

    expect(fakeApi.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("delivery_confirmed"),
    );
    expect(fakeApi.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("98765"),
    );

    expect(fakeApi.runtime.channel.telegram.sendMessageTelegram).toHaveBeenCalledWith(
      "123456",
      expect.any(String),
      expect.objectContaining({
        accountId: "tg-main",
        textMode: "markdown",
      }),
    );
  });

  it("Telegram delivery rethrows when official sendMessageTelegram fails", async () => {
    seedTelegramRuntime("xiaox");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results"), { recursive: true });

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    const fakeApi = buildTelegramDeliveryHarness();
    fakeApi.runtime.channel.telegram.sendMessageTelegram.mockRejectedValue(
      new Error("Telegram API 403: bot was blocked by the user"),
    );
    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "xiaox@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "zh-CN",
          preferred_language: "zh-CN",
        },
        name: "xiaox",
        stateDir: path.join(fakeHome, ".chorus", "state", "xiaox"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    await expect(adapter.deliverInbound(deliverInboundParams))
      .rejects.toThrow("Telegram API 403: bot was blocked by the user");
  });

  it("Telegram delivery timeout produces unverifiable receipt, not confirmed", async () => {
    seedTelegramRuntime("xiaox");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results"), { recursive: true });
    fs.mkdirSync(path.join(fakeHome, ".chorus", "debug"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".chorus", "debug", "host-timeout.json"),
      JSON.stringify({
        enabled: true,
        agent: "xiaox",
        channel: "telegram",
        trace_id: "trace-tg-ack",
        mode: "hang_before_send",
        timeout_ms: 50,
      }),
      "utf-8",
    );

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    const fakeApi = buildTelegramDeliveryHarness();
    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "xiaox@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "zh-CN",
          preferred_language: "zh-CN",
        },
        name: "xiaox",
        stateDir: path.join(fakeHome, ".chorus", "state", "xiaox"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    const receipt = await adapter.deliverInbound(deliverInboundParams);

    expect(receipt.status).toBe("unverifiable");
    expect(receipt.method).toBe("timeout");
    expect(receipt.ref).toBeNull();

    const deliveryFile = path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results", "trace-tg-ack.json");
    const deliveryRecord = JSON.parse(fs.readFileSync(deliveryFile, "utf-8"));
    expect(deliveryRecord.status).toBe("unverifiable");
  });

  // --- Default-only Telegram (single agent, flat config, accountId=default) ---

  it("Default-only Telegram delivery: accountId=default delegates to channel helper", async () => {
    seedTelegramRuntimeDefaultOnly("xiaox");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "state", "xiaox", "delivery-results"), { recursive: true });

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    const fakeApi = buildTelegramDeliveryHarness();
    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "xiaox@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "zh-CN",
          preferred_language: "zh-CN",
        },
        name: "xiaox",
        stateDir: path.join(fakeHome, ".chorus", "state", "xiaox"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    const receipt = await adapter.deliverInbound({
      ...deliverInboundParams,
      metadata: { ...deliverInboundParams.metadata, trace_id: "trace-default-tg" },
    });

    expect(receipt.status).toBe("confirmed");
    expect(receipt.method).toBe("telegram_server_ack");
    expect(receipt.ref).toBe("98765");

    expect(fakeApi.runtime.channel.telegram.sendMessageTelegram).toHaveBeenCalledWith(
      "789012",
      expect.any(String),
      expect.objectContaining({
        accountId: "default",
        textMode: "markdown",
      }),
    );
  });

  it("Fallback route: agent name mismatch walks single-candidate fallback to default accountId", async () => {
    // Chorus agent name is "goooo" but OpenClaw agent dir is "main"
    seedTelegramRuntimeFallback("main");
    fs.mkdirSync(path.join(fakeHome, ".chorus", "state", "goooo", "delivery-results"), { recursive: true });

    jest.doMock("node:os", () => ({
      ...jest.requireActual("node:os"),
      homedir: () => fakeHome,
    }));

    const { OpenClawHostAdapter } = await import("../../packages/chorus-skill/templates/bridge/runtime-v2");

    const fakeApi = buildTelegramDeliveryHarness();
    const adapter = new OpenClawHostAdapter(
      {
        config: {
          agent_id: "goooo@chorus",
          api_key: "test-key",
          hub_url: "https://hub.example",
          culture: "en",
          preferred_language: "en",
        },
        name: "goooo",
        stateDir: path.join(fakeHome, ".chorus", "state", "goooo"),
      },
      fakeApi as never,
      fakeApi.logger,
      null,
    );

    const receipt = await adapter.deliverInbound({
      ...deliverInboundParams,
      metadata: { ...deliverInboundParams.metadata, trace_id: "trace-fallback-tg" },
    });

    expect(receipt.status).toBe("confirmed");
    expect(receipt.method).toBe("telegram_server_ack");

    expect(fakeApi.runtime.channel.telegram.sendMessageTelegram).toHaveBeenCalledWith(
      "789012",
      expect.any(String),
      expect.objectContaining({
        accountId: "default",
      }),
    );
  });

  // --- Credential loading and activation watcher tests ---

  const seedWorkspaceCredential = (overrides?: Record<string, unknown>): void => {
    const dir = path.join(fakeHome, ".openclaw", "workspace");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "chorus-credentials.json"),
      JSON.stringify({
        agent_id: "workspace-agent@chorus",
        api_key: "ws-key",
        hub_url: "https://hub.workspace.example",
        ...overrides,
      }),
      "utf-8",
    );
  };

  const seedLegacyConfig = (): void => {
    fs.mkdirSync(path.join(fakeHome, ".chorus"), { recursive: true });
    fs.writeFileSync(
      path.join(fakeHome, ".chorus", "config.json"),
      JSON.stringify({
        agent_id: "legacy-agent@chorus",
        api_key: "legacy-key",
        hub_url: "https://hub.legacy.example",
      }),
      "utf-8",
    );
  };

  it("gateway_start loads workspace credentials from ~/.openclaw/workspace/chorus-credentials.json", async () => {
    seedWorkspaceCredential();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("activated: workspace-agent@chorus from workspace/chorus-credentials.json"),
    );
    const activationProof = JSON.parse(
      fs.readFileSync(activationProofPathFor(fakeHome, "workspace-agent@chorus"), "utf-8"),
    );
    expect(activationProof.agent_id).toBe("workspace-agent@chorus");
    expect(activationProof.proof_source).toBe("chorus-bridge/runtime-v2 activateBridge");
  });

  it("gateway_start loads configs from ~/.chorus/agents/ (backward compat)", async () => {
    seedAgentConfig();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("activated: xiaov@openclaw from agents/xiaov.json"),
    );
  });

  it("gateway_start loads legacy config.json when no other sources exist", async () => {
    seedLegacyConfig();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("activated: legacy-agent@chorus from config.json"),
    );
  });

  it("gateway_start loads workspace first then agents dir (priority order, both used)", async () => {
    seedWorkspaceCredential();
    seedAgentConfig();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    // Both configs loaded, workspace first + agents dir second = 2 agents
    expect(recover).toHaveBeenCalledTimes(2);

    const infoLogs = (api.logger.info as jest.Mock).mock.calls.map((c: unknown[]) => String(c[0]));
    const workspaceIdx = infoLogs.findIndex((m) =>
      m.includes("activated: workspace-agent@chorus from workspace/chorus-credentials.json"),
    );
    const agentsIdx = infoLogs.findIndex((m) =>
      m.includes("activated: xiaov@openclaw from agents/xiaov.json"),
    );
    expect(workspaceIdx).toBeGreaterThanOrEqual(0);
    expect(agentsIdx).toBeGreaterThanOrEqual(0);
    expect(workspaceIdx).toBeLessThan(agentsIdx);
  });

  it("gateway_start skips malformed workspace credential with appropriate log", async () => {
    seedWorkspaceCredential({ api_key: "" }); // invalid: empty api_key
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    // No valid configs -> watcher starts, recover not called
    expect(recover).not.toHaveBeenCalled();
    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("malformed config skipped: workspace/chorus-credentials.json"),
    );
  });

  it("gateway_start watches for activation when no credentials exist and activates when credentials appear", async () => {
    // Start with no credentials at all
    installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");

    jest.useFakeTimers();
    try {
      await gatewayStart?.();

      // Should log "watching for activation"
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("no credentials found, watching for activation..."),
      );

      // Now write a credential file while watcher is running
      seedWorkspaceCredential();

      // Advance past the 5s poll interval
      await jest.advanceTimersByTimeAsync(5_000);

      // Should detect and activate
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("credentials detected, activating..."),
      );
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("activated: workspace-agent@chorus from workspace/chorus-credentials.json"),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("gateway_start activates using bundled runtime when no source repo exists", async () => {
    seedAgentConfig();
    seedBundledRuntime();
    const { recover } = installMocks(jest.fn().mockResolvedValue({}));
    const { api, hooks } = buildFakeApi();

    const register = (await import("../../packages/chorus-skill/templates/bridge/index")).default;
    register(api);

    const gatewayStart = hooks.get("gateway_start");
    await gatewayStart?.();

    // Recovery engine should have been called (modules loaded successfully)
    expect(recover).toHaveBeenCalledTimes(1);
    // Should log loading from runtime directory (bundled path)
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("loading runtime modules from"),
    );
  });
});
