import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { buildTrustBoundary } from "./guard";
import {
  resolveDeliveryTargetFromSessions,
  resolveReceiverPrefs,
  primarySubtag,
  splitReplyParts,
  diagnoseUserText,
  deriveChorusSessionKey,
} from "./resolve";
import {
  buildChorusRouterInjection,
  contentToText,
  extractContinuationReplyBody,
  extractLatestUserText,
  isChorusSession,
  isContinuationRequest,
} from "./router-hook";

const CHORUS_PROJECT = "/Volumes/XDISK/chorus";
const CHORUS_DIR = join(homedir(), ".chorus");
const AGENTS_DIR = join(CHORUS_DIR, "agents");
const CONFIG_PATH = join(CHORUS_DIR, "config.json");
const OPENCLAW_DIR = join(homedir(), ".openclaw");
const WEIXIN_SRC = join(OPENCLAW_DIR, "extensions", "openclaw-weixin", "src");
const WEIXIN_DIR = join(OPENCLAW_DIR, "extensions", "openclaw-weixin");
const DEBUG_DIR = join(CHORUS_DIR, "debug");
const HOST_TIMEOUT_INJECTION_PATH = join(DEBUG_DIR, "host-timeout.json");
const HUB_CATCHUP_TIMEOUT_INJECTION_PATH = join(DEBUG_DIR, "hub-catchup-timeout.json");
const DEFAULT_HOST_DELIVERY_TIMEOUT_MS = 15_000;
const TAG = "[chorus-bridge]";

type ChorusConfig = {
  readonly agent_id: string;
  readonly api_key: string;
  readonly hub_url: string;
  readonly culture?: string;
  readonly preferred_language?: string;
};

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type ActiveChorusPeer = {
  readonly peerId: string;
  readonly peerLabel: string;
  readonly conversationId: string | null;
  readonly updatedAt: string;
  readonly routeKey: string;
  readonly lastInboundSummary: string | null;
  readonly lastOutboundReply: string | null;
};

type DurableInboundFact = {
  readonly route_key?: unknown;
  readonly hub_timestamp?: unknown;
  readonly dedupe_result?: unknown;
  readonly envelope_projection?: {
    readonly original_text?: unknown;
  } | null;
};

type DurableRelayEvidence = {
  readonly route_key?: unknown;
  readonly reply_text?: unknown;
  readonly bound_turn_number?: unknown;
};

type DeliveryResultRecord = {
  readonly trace_id: string;
  readonly peer: string;
  readonly status: "confirmed" | "unverifiable";
  readonly method: string;
  readonly channel: string;
  readonly terminal_disposition: string | null;
  readonly recorded_at: string;
};

type HostTimeoutInjection = {
  readonly enabled?: boolean;
  readonly agent?: string;
  readonly channel?: string;
  readonly trace_id?: string;
  readonly original_text_contains?: string;
  readonly timeout_ms?: number;
  readonly mode?: "hang_before_send" | "throw_before_send";
  readonly consume_once?: boolean;
};

type HubCatchupTimeoutInjection = {
  readonly enabled?: boolean;
  readonly agent?: string;
  readonly timeout_ms?: number;
  readonly max_retries?: number;
  readonly consume_once?: boolean;
};

type WeixinModules = {
  readonly accounts: {
    resolveWeixinAccount: (
      cfg: unknown,
      accountId: string,
    ) => { baseUrl: string; token?: string };
  };
  readonly inbound: {
    getContextToken: (accountId: string, userId: string) => string | undefined;
  };
  readonly send: {
    markdownToPlainText: (text: string) => string;
    sendMessageWeixin: (params: {
      to: string;
      text: string;
      opts: { baseUrl: string; token?: string; contextToken?: string };
    }) => Promise<{ messageId: string }>;
  };
};

type RuntimeModules = {
  readonly DurableStateManager: new (stateDir: string, agentId: string) => any;
  readonly InboundPipeline: new (
    stateManager: any,
    hostAdapter: any,
    config: { localAgentId: string; localCulture: string; deliverTimeoutMs?: number },
    onError?: (msg: string) => void,
  ) => any;
  readonly OutboundPipeline: new (
    stateManager: any,
    config: { localAgentId: string; localCulture: string },
  ) => any;
  readonly RecoveryEngine: new (
    config: { agentId: string; apiKey: string; maxCatchupRetries?: number },
    onError?: (msg: string) => void,
  ) => any;
  readonly HubClient: new (
    hubUrl: string,
    config?: { fetchTimeoutMs?: number; relayTimeoutMs?: number },
  ) => any;
};

type PluginApi = {
  config: Record<string, unknown>;
  runtime: { channel: Record<string, any> };
  logger: Logger;
};

type ReplyCallback = (params: {
  readonly route_key: string;
  readonly reply_text: string;
  readonly inbound_trace_id: string | null;
}) => void;

type AgentRuntimeContext = {
  readonly config: ChorusConfig;
  readonly name: string;
  readonly stateDir: string;
};

type ContinuationTurnContext = {
  readonly routeKey: string;
  readonly peerId: string;
};

let pluginApi: PluginApi | null = null;
const liveRuntimeByAgentName = new Map<string, {
  readonly outboundPipeline: any;
  readonly hubClient: any;
  readonly config: ChorusConfig;
}>();
const pendingContinuationBySession = new Map<string, ContinuationTurnContext>();

function readJSON(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function summarizeInboundText(text: string | null): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return null;
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217)}...`;
}

function compareDescendingString(a: string, b: string): number {
  return b.localeCompare(a);
}

function createAgentRuntimeContext(config: ChorusConfig): AgentRuntimeContext {
  const name = config.agent_id.split("@")[0];
  return {
    config,
    name,
    stateDir: join(CHORUS_DIR, "state", name),
  };
}

function ensureAgentDirs(ctx: AgentRuntimeContext): void {
  mkdirSync(ctx.stateDir, { recursive: true });
  mkdirSync(join(ctx.stateDir, "delivery-results"), { recursive: true });
}

function stateFilePathForAgent(agentId: string): string {
  const name = agentId.split("@")[0];
  return join(CHORUS_DIR, "state", name, `${agentId}.json`);
}

function resolveStateFilePath(agentId: string | undefined): string | null {
  if (!agentId || typeof agentId !== "string") return null;

  const exactPath = stateFilePathForAgent(agentId);
  if (existsSync(exactPath)) return exactPath;

  const shortName = agentId.split("@")[0];
  const stateDir = join(CHORUS_DIR, "state", shortName);
  if (!existsSync(stateDir)) return null;

  const candidates = readdirSync(stateDir)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => file === `${shortName}.json` || file.startsWith(`${shortName}@`))
    .sort();

  if (candidates.length === 1) {
    return join(stateDir, candidates[0]);
  }

  const preferred = candidates.find((file) => file.startsWith(`${shortName}@`));
  return preferred ? join(stateDir, preferred) : null;
}

function loadActivePeerFromDurableState(
  agentId: string | undefined,
  sessionKey: string | undefined,
  options?: {
    readonly preferRemotePeer?: boolean;
  },
): ActiveChorusPeer | null {
  if (typeof sessionKey !== "string" || sessionKey.length === 0) return null;
  const stateFilePath = resolveStateFilePath(agentId);
  if (!stateFilePath) return null;
  const raw = readJSON(stateFilePath);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const root = raw as Record<string, unknown>;
  const canonicalAgentId = typeof root.agent_id === "string" ? root.agent_id : null;
  const continuity = root.continuity;
  if (!continuity || typeof continuity !== "object" || Array.isArray(continuity)) {
    return null;
  }
  const inboundFacts = root.inbound_facts && typeof root.inbound_facts === "object" && !Array.isArray(root.inbound_facts)
    ? root.inbound_facts as Record<string, DurableInboundFact>
    : {};
  const relayEvidence = root.relay_evidence && typeof root.relay_evidence === "object" && !Array.isArray(root.relay_evidence)
    ? root.relay_evidence as Record<string, DurableRelayEvidence>
    : {};

  const entries = Object.entries(continuity as Record<string, unknown>)
    .map(([routeKey, rawEntry]) => {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
        return null;
      }
      const entry = rawEntry as Record<string, unknown>;
      if (typeof entry.remote_peer_id !== "string") return null;
      if (typeof entry.local_anchor_id !== "string") return null;
      if (entry.local_anchor_id !== sessionKey) {
        return null;
      }
      const latestInbound = Object.entries(inboundFacts)
        .filter(([, fact]) =>
          fact &&
          fact.route_key === routeKey &&
          fact.dedupe_result === "new" &&
          fact.envelope_projection &&
          typeof fact.envelope_projection.original_text === "string",
        )
        .sort(([traceIdA, factA], [traceIdB, factB]) => {
          const tsA = typeof factA.hub_timestamp === "string" ? factA.hub_timestamp : "";
          const tsB = typeof factB.hub_timestamp === "string" ? factB.hub_timestamp : "";
          if (tsA !== tsB) return compareDescendingString(tsA, tsB);
          return compareDescendingString(traceIdA, traceIdB);
        })[0];
      const latestOutbound = Object.values(relayEvidence)
        .filter((record) =>
          record &&
          record.route_key === routeKey &&
          typeof record.reply_text === "string" &&
          typeof record.bound_turn_number === "number",
        )
        .sort((a, b) => {
          const turnA = typeof a.bound_turn_number === "number" ? a.bound_turn_number : -1;
          const turnB = typeof b.bound_turn_number === "number" ? b.bound_turn_number : -1;
          return turnB - turnA;
        })[0];
      return {
        peerId: entry.remote_peer_id,
        conversationId: typeof entry.conversation_id === "string"
          ? entry.conversation_id
          : null,
        updatedAt: typeof entry.updated_at === "string"
          ? entry.updated_at
          : "",
        routeKey,
        lastInboundSummary: summarizeInboundText(
          latestInbound && latestInbound[1].envelope_projection && typeof latestInbound[1].envelope_projection.original_text === "string"
            ? latestInbound[1].envelope_projection.original_text
            : null,
        ),
        lastOutboundReply: typeof latestOutbound?.reply_text === "string"
          ? latestOutbound.reply_text.trim() || null
          : null,
      };
    })
    .filter((value): value is {
      readonly peerId: string;
      readonly conversationId: string | null;
      readonly updatedAt: string;
      readonly routeKey: string;
      readonly lastInboundSummary: string | null;
      readonly lastOutboundReply: string | null;
    } => value !== null)
    .sort((a, b) => {
      if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return a.routeKey.localeCompare(b.routeKey);
    });

  if (entries.length === 0) return null;
  const preferRemotePeer = options?.preferRemotePeer === true;
  const remoteEntries = canonicalAgentId
    ? entries.filter((entry) => entry.peerId !== canonicalAgentId)
    : entries;
  const winner = preferRemotePeer && remoteEntries.length > 0 ? remoteEntries[0] : entries[0];
  return {
    peerId: winner.peerId,
    peerLabel: winner.peerId.split("@")[0] || winner.peerId,
    conversationId: winner.conversationId,
    updatedAt: winner.updatedAt,
    routeKey: winner.routeKey,
    lastInboundSummary: winner.lastInboundSummary,
    lastOutboundReply: winner.lastOutboundReply,
  };
}

function continuationSessionKey(
  agentId: string | undefined,
  sessionKey: string | undefined,
): string | null {
  const agentName = normalizeHookAgentName(agentId);
  if (!agentName || typeof sessionKey !== "string" || sessionKey.length === 0) {
    return null;
  }
  return `${agentName}::${sessionKey}`;
}

function extractLatestAssistantText(messages: readonly unknown[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const raw = messages[i];
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    if (msg.role !== "assistant") continue;
    const content = Array.isArray(msg.content) ? msg.content : [];
    const text = content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const rec = block as Record<string, unknown>;
        return rec.type === "text" && typeof rec.text === "string" ? rec.text : "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return null;
}

function latestTurnUsesTools(messages: readonly unknown[]): boolean {
  let sawLatestUser = false;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const raw = messages[i];
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    const nested = msg.message && typeof msg.message === "object"
      ? msg.message as Record<string, unknown>
      : null;
    const role = nested?.role ?? msg.role;
    const content = nested?.content ?? msg.content;

    if (role === "user") {
      sawLatestUser = true;
      break;
    }

    if (role === "toolResult") return true;
    if (role !== "assistant" || !Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const rec = block as Record<string, unknown>;
      if (rec.type === "toolCall") return true;
    }
  }

  return sawLatestUser ? false : false;
}

function normalizeHookAgentName(agentId: string | undefined): string | null {
  if (!agentId || typeof agentId !== "string") return null;
  const trimmed = agentId.trim();
  if (trimmed.length === 0) return null;
  return trimmed.split("@")[0] || null;
}

function loadAgentConfigs(log: Logger): ChorusConfig[] {
  const configs: ChorusConfig[] = [];

  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const cfg = readJSON(join(AGENTS_DIR, file)) as ChorusConfig | null;
      if (cfg?.agent_id && cfg?.api_key && cfg?.hub_url) {
        configs.push(cfg);
        log.info(`${TAG} loaded agent config: ${cfg.agent_id} from agents/${file}`);
      }
    }
  }

  if (configs.length === 0) {
    const cfg = readJSON(CONFIG_PATH) as ChorusConfig | null;
    if (cfg?.agent_id && cfg?.api_key && cfg?.hub_url) {
      configs.push(cfg);
      log.info(`${TAG} loaded legacy single config: ${cfg.agent_id}`);
    }
  }

  return configs;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      return;
    }
    throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
  }
}

function resolveTelegramBotToken(accountId: string): string | null {
  const cfgPath = join(OPENCLAW_DIR, "openclaw.json");
  const raw = readJSON(cfgPath) as Record<string, any> | null;
  return raw?.channels?.telegram?.accounts?.[accountId]?.botToken ?? null;
}

async function buildImportFn(
  log: Logger,
): Promise<(specifier: string) => Promise<any>> {
  const candidates = [
    join(homedir(), ".npm-global", "lib", "node_modules", "openclaw"),
    join("/", "usr", "local", "lib", "node_modules", "openclaw"),
  ];

  for (const pkgRoot of candidates) {
    const jitiEntry = join(pkgRoot, "node_modules", "jiti", "lib", "jiti.mjs");
    const sdkAlias = join(pkgRoot, "dist", "plugin-sdk", "root-alias.cjs");
    if (!existsSync(jitiEntry) || !existsSync(sdkAlias)) continue;

    try {
      const { pathToFileURL } = await import("node:url");
      const { createJiti } = await import(pathToFileURL(jitiEntry).href);
      const jiti = (createJiti as any)(join(
        CHORUS_PROJECT,
        "packages",
        "chorus-skill",
        "templates",
        "bridge",
        "runtime-v2.ts",
      ), {
        interopDefault: true,
        extensions: [".ts", ".tsx", ".mts", ".js", ".mjs"],
        alias: { "openclaw/plugin-sdk": sdkAlias },
      });
      log.info(`${TAG} jiti loaded from ${pkgRoot}`);
      return (specifier: string) => jiti.import(specifier);
    } catch (err) {
      log.info(`${TAG} jiti load failed from ${pkgRoot}: ${err}`);
    }
  }

  // @ts-expect-error runtime optional dependency resolved from OpenClaw or process context
  const { createJiti } = await import("jiti");
  const jiti = (createJiti as any)(join(
    CHORUS_PROJECT,
    "packages",
    "chorus-skill",
    "templates",
    "bridge",
    "runtime-v2.ts",
  ), {
    interopDefault: true,
    extensions: [".ts", ".tsx", ".mts", ".js", ".mjs"],
  });
  log.info(`${TAG} jiti from process context (no SDK alias)`);
  return (specifier: string) => jiti.import(specifier);
}

async function probeWeixinDeps(log: Logger): Promise<{
  ok: boolean;
  reason?: string;
  modules?: WeixinModules;
}> {
  if (!existsSync(WEIXIN_DIR)) {
    return { ok: false, reason: "weixin plugin directory not found" };
  }

  const importFn = await buildImportFn(log);
  const extensions = [".ts", ".js", ""];

  for (const ext of extensions) {
    try {
      const inboundPath = join(WEIXIN_SRC, "messaging", "inbound" + ext);
      const inboundMod = await importFn(inboundPath);
      if (typeof inboundMod.getContextToken !== "function") continue;

      const accountsMod = await importFn(join(WEIXIN_SRC, "auth", "accounts" + ext));
      if (typeof accountsMod.resolveWeixinAccount !== "function") continue;

      const sendMod = await importFn(join(WEIXIN_SRC, "messaging", "send" + ext));
      if (typeof sendMod.sendMessageWeixin !== "function") continue;
      if (typeof sendMod.markdownToPlainText !== "function") continue;

      return {
        ok: true,
        modules: { accounts: accountsMod, inbound: inboundMod, send: sendMod },
      };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "weixin module imports failed" };
}

async function loadRuntimeModules(log: Logger): Promise<RuntimeModules | null> {
  try {
    const importFn = await buildImportFn(log);
    const [stateMod, inboundMod, outboundMod, recoveryMod, hubClientMod] = await Promise.all([
      importFn(join(CHORUS_PROJECT, "src", "bridge", "state.ts")),
      importFn(join(CHORUS_PROJECT, "src", "bridge", "inbound.ts")),
      importFn(join(CHORUS_PROJECT, "src", "bridge", "outbound.ts")),
      importFn(join(CHORUS_PROJECT, "src", "bridge", "recovery.ts")),
      importFn(join(CHORUS_PROJECT, "src", "bridge", "hub-client.ts")),
    ]);
    return {
      DurableStateManager: stateMod.DurableStateManager,
      InboundPipeline: inboundMod.InboundPipeline,
      OutboundPipeline: outboundMod.OutboundPipeline,
      RecoveryEngine: recoveryMod.RecoveryEngine,
      HubClient: hubClientMod.HubClient,
    };
  } catch (err) {
    log.error(`${TAG} failed to load V2 bridge runtime: ${String(err)}`);
    return null;
  }
}

function loadHostTimeoutInjection(): HostTimeoutInjection | null {
  const raw = readJSON(HOST_TIMEOUT_INJECTION_PATH);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as HostTimeoutInjection;
}

function consumeHostTimeoutInjection(): void {
  try {
    unlinkSync(HOST_TIMEOUT_INJECTION_PATH);
  } catch {
    /* ignore */
  }
}

function matchHostTimeoutInjection(
  ctx: AgentRuntimeContext,
  params: { channel: string; traceId: string; originalText: string },
): HostTimeoutInjection | null {
  const injection = loadHostTimeoutInjection();
  if (!injection || injection.enabled === false) return null;
  if (injection.agent && injection.agent !== ctx.name) return null;
  if (injection.channel && injection.channel !== params.channel) return null;
  if (injection.trace_id && injection.trace_id !== params.traceId) return null;
  if (
    injection.original_text_contains &&
    !params.originalText.includes(injection.original_text_contains)
  ) {
    return null;
  }
  if (injection.consume_once !== false) consumeHostTimeoutInjection();
  return injection;
}

function loadHubCatchupTimeoutInjection(): HubCatchupTimeoutInjection | null {
  const raw = readJSON(HUB_CATCHUP_TIMEOUT_INJECTION_PATH);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as HubCatchupTimeoutInjection;
}

function consumeHubCatchupTimeoutInjection(): void {
  try {
    unlinkSync(HUB_CATCHUP_TIMEOUT_INJECTION_PATH);
  } catch {
    /* ignore */
  }
}

function matchHubCatchupTimeoutInjection(
  ctx: AgentRuntimeContext,
): HubCatchupTimeoutInjection | null {
  const injection = loadHubCatchupTimeoutInjection();
  if (!injection || injection.enabled === false) return null;
  if (injection.agent && injection.agent !== ctx.name) return null;
  if (injection.consume_once !== false) consumeHubCatchupTimeoutInjection();
  return injection;
}

const HOST_DELIVERY_TIMEOUT_SENTINEL = Symbol("host_delivery_timeout");

async function withHostDeliveryTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof HOST_DELIVERY_TIMEOUT_SENTINEL> {
  const holder: { timer: ReturnType<typeof setTimeout> | null } = { timer: null };
  const result = await Promise.race([
    work,
    new Promise<typeof HOST_DELIVERY_TIMEOUT_SENTINEL>((resolve) => {
      holder.timer = setTimeout(() => resolve(HOST_DELIVERY_TIMEOUT_SENTINEL), timeoutMs);
    }),
  ]);
  if (holder.timer !== null) clearTimeout(holder.timer);
  return result;
}

function resolveDeliveryTarget(agentName: string) {
  const sessionsPath = join(
    OPENCLAW_DIR,
    "agents",
    agentName,
    "sessions",
    "sessions.json",
  );
  const sessions = readJSON(sessionsPath) as Record<string, any> | null;
  return resolveDeliveryTargetFromSessions(sessions, agentName);
}

function saveDeliveryResult(
  ctx: AgentRuntimeContext,
  traceId: string,
  result: DeliveryResultRecord,
): void {
  writeJSON(join(ctx.stateDir, "delivery-results", `${traceId}.json`), result);
}

function recordUnverifiableDelivery(
  ctx: AgentRuntimeContext,
  log: Logger,
  params: {
    traceId: string;
    peer: string;
    channel: string;
    method: string;
  },
): void {
  const recordedAt = new Date().toISOString();
  const result: DeliveryResultRecord = {
    trace_id: params.traceId,
    peer: params.peer,
    status: "unverifiable",
    method: params.method,
    channel: params.channel,
    terminal_disposition: "delivery_unverifiable",
    recorded_at: recordedAt,
  };
  saveDeliveryResult(ctx, params.traceId, result);
  log.info(`${TAG} [bridge:delivery] ${JSON.stringify({
    event: "delivery_unverifiable",
    trace_id: params.traceId,
    peer: params.peer,
    channel: params.channel,
    method: params.method,
    terminal_disposition: "delivery_unverifiable",
    timestamp: recordedAt,
  })}`);
}

export class OpenClawHostAdapter {
  private readonly ctx: AgentRuntimeContext;
  private readonly api: PluginApi;
  private readonly log: Logger;
  private readonly weixinMods: WeixinModules | null;
  private replyCallback: ReplyCallback | null = null;

  constructor(
    ctx: AgentRuntimeContext,
    api: NonNullable<typeof pluginApi>,
    log: Logger,
    weixinMods: WeixinModules | null,
  ) {
    this.ctx = ctx;
    this.api = api;
    this.log = log;
    this.weixinMods = weixinMods;
  }

  async adaptContent(params: {
    readonly original_text: string;
    readonly sender_culture: string;
    readonly receiver_culture: string;
    readonly cultural_context: string | null;
  }): Promise<string> {
    return params.original_text;
  }

  onReplyDetected(callback: ReplyCallback): void {
    this.replyCallback = callback;
  }

  async resolveLocalAnchor(_routeKey: string): Promise<string> {
    return `agent:${this.ctx.name}:main`;
  }

  async acquireHandles(): Promise<void> {
    /* handles are resolved per delivery attempt */
  }

  async releaseHandles(): Promise<void> {
    this.replyCallback = null;
  }

  async deliverInbound(params: {
    readonly route_key: string;
    readonly local_anchor_id: string;
    readonly adapted_content: string;
    readonly metadata: {
      readonly sender_id: string;
      readonly sender_culture: string;
      readonly cultural_context: string | null;
      readonly conversation_id: string | null;
      readonly turn_number: number;
      readonly trace_id: string;
    };
  }): Promise<{
    readonly status: "confirmed" | "unverifiable" | "failed";
    readonly method: string;
    readonly ref: string | null;
    readonly timestamp: string;
  }> {
    const ch = this.api.runtime.channel;
    const cfg = this.api.config;

    const target = resolveDeliveryTarget(this.ctx.name);
    if (!target) {
      throw new Error(`no_delivery_target agent=${this.ctx.name}`);
    }

    const route = ch.routing.resolveAgentRoute({
      cfg,
      channel: target.channel,
      accountId: target.accountId,
      peer: { kind: "direct", id: target.to },
    });
    if (!route.agentId) {
      throw new Error(`no_agent_route target=${target.to} agent=${this.ctx.name}`);
    }

    const receiverPrefs = resolveReceiverPrefs(this.ctx.config);
    if (!receiverPrefs) {
      throw new Error(`no_culture_config agent=${this.ctx.name}`);
    }

    let contextToken: string | undefined;
    let account: { baseUrl: string; token?: string } | undefined;
    let telegramBotToken: string | null = null;

    if (target.channel === "openclaw-weixin") {
      if (!this.weixinMods) {
        throw new Error(`wx_adapter_unavailable agent=${this.ctx.name}`);
      }
      contextToken = this.weixinMods.inbound.getContextToken(target.accountId, target.to);
      if (!contextToken) {
        throw new Error(`no_context_token to=${target.to} accountId=${target.accountId} agent=${this.ctx.name}`);
      }
      account = this.weixinMods.accounts.resolveWeixinAccount(cfg, target.accountId);
      if (!account?.baseUrl) {
        throw new Error(`no_wx_base_url accountId=${target.accountId} agent=${this.ctx.name}`);
      }
    } else if (target.channel === "telegram") {
      telegramBotToken = resolveTelegramBotToken(target.accountId);
      if (!telegramBotToken) {
        throw new Error(`no_tg_bot_token accountId=${target.accountId} agent=${this.ctx.name}`);
      }
    } else {
      throw new Error(`unsupported_channel channel=${target.channel} agent=${this.ctx.name}`);
    }

    const mustAdapt =
      primarySubtag(params.metadata.sender_culture) !==
      primarySubtag(receiverPrefs.preferredLanguage);
    const trust = buildTrustBoundary(params.adapted_content);
    const chorusSessionKey = deriveChorusSessionKey(
      this.ctx.name,
      params.metadata.sender_id,
      params.metadata.conversation_id,
    );

    const chorusPayload = {
      _type: "chorus_inbound",
      ...trust,
      sender_id: params.metadata.sender_id,
      sender_culture: params.metadata.sender_culture,
      cultural_context: params.metadata.cultural_context,
      conversation_id: params.metadata.conversation_id,
      turn_number: params.metadata.turn_number,
      receiver_culture: receiverPrefs.culture,
      receiver_preferred_language: receiverPrefs.preferredLanguage,
      must_adapt: mustAdapt,
      adaptation_instruction: mustAdapt
        ? `CRITICAL: The receiver's language is ${receiverPrefs.preferredLanguage}. You MUST translate/adapt the message into ${receiverPrefs.preferredLanguage} before delivering. Do NOT forward the original ${params.metadata.sender_culture} text as-is. Output ONLY in ${receiverPrefs.preferredLanguage}.`
        : null,
      reply_format: `Your reply has two audiences. CRITICAL: both parts MUST be inside your final answer — anything placed after your main response is silently discarded by the runtime.

This is a Chorus protocol turn, not a normal local chat turn.

Hard rules:
- Do NOT call message/send tools or any local channel tool to contact the current user directly.
- Do NOT use [[reply_to_current]] or any equivalent current-user reply marker.
- Text above [chorus_reply] is user-facing only.
- Text below [chorus_reply] is chorus-facing only.
- The user-facing part MUST be a rewritten retelling for the local user, in the local user's language.
- The user-facing part MUST speak only to the current local user, never to the remote agent.
- Rewrite the remote agent's words into third-person retelling for the local user. Do NOT address the remote agent as "you", "姐姐", or any other direct second-person form in the user-facing part.
- Do NOT transparently forward or quote the remote agent's original Chorus text into the user-facing part.
- If you reply back to the remote agent, the user-facing part should briefly tell the local user both what the remote agent said and what you sent back.
- The chorus-facing part MUST address the remote agent, not Owen / 哥哥 / the current user.
- If you are reporting that you already told the current user something, that belongs in the user-facing part, not the chorus-facing part.
- If the remote message says "tell Owen ..." or equivalent, your chorus-facing reply should tell the remote agent what you did or ask the remote agent a follow-up. It must not speak to Owen directly.

Format your ENTIRE response as one continuous block:

[natural message for your user, in ${receiverPrefs.preferredLanguage}]
[chorus_reply]
[your conversational response to the remote agent, in your own language/culture]

The [chorus_reply] marker goes on its own line WITHIN your answer. Everything above it is delivered to your user. Everything below it is relayed to the remote agent.

If you have nothing to say back to the remote agent, simply omit [chorus_reply] — your whole answer goes to the user only.`,
    };

    const chorusPreamble = [
      "CHORUS PROTOCOL TURN — HARD RULES",
      "This is NOT a normal local chat turn.",
      `The current local user's language is ${receiverPrefs.preferredLanguage}.`,
      mustAdapt
        ? `You MUST rewrite the user-facing part into ${receiverPrefs.preferredLanguage}. Do NOT transparently forward the remote agent's original ${params.metadata.sender_culture} text to the user.`
        : "You MUST keep the user-facing part in the local user's language.",
      "Do NOT use [[reply_to_current]], [[reply_to_user]], or any other local reply marker.",
      "Do NOT call message/send or any local channel tool.",
      "Everything above [chorus_reply] is user-facing only.",
      "Everything below [chorus_reply] is chorus-facing only.",
      "The user-facing part must speak only to the current local user, never to the remote agent.",
      "Rewrite the remote agent's words into third-person retelling for the user. Do NOT address the remote agent as 'you', '姐姐', or any other direct second-person form in the user-facing part.",
      "If you reply back to the remote agent, briefly tell the current local user what you replied.",
      "The chorus-facing part must address the remote agent, not Owen / 哥哥 / the current user.",
      "If the remote message says 'tell Owen ...', the user-facing part may tell the user, but the chorus-facing part must report back to the remote agent instead of speaking to Owen directly.",
      "",
      "Input payload follows as JSON:",
      JSON.stringify(chorusPayload),
    ].join("\n");

    const ctxMsg: Record<string, unknown> = {
      Body: chorusPreamble,
      From: target.to,
      To: target.to,
      AccountId: target.accountId,
      OriginatingChannel: "chorus-bridge",
      OriginatingTo: target.to,
      MessageSid: `chorus-${params.metadata.trace_id}`,
      Timestamp: Date.now(),
      Provider: "chorus-bridge",
      ChatType: "direct",
      SessionKey: chorusSessionKey,
    };

    const storePath = ch.session.resolveStorePath(
      (cfg as any).session?.store,
      { agentId: route.agentId },
    );
    const finalized = ch.reply.finalizeInboundContext(ctxMsg);

    await ch.session.recordInboundSession({
      storePath,
      sessionKey: chorusSessionKey,
      ctx: finalized,
      updateLastRoute: {
        sessionKey: chorusSessionKey,
        channel: target.channel,
        to: target.to,
        accountId: target.accountId,
      },
      onRecordError: (err: unknown) =>
        this.log.error(`${TAG} recordInboundSession: ${err}`),
    });

    let deliveryReceipt: {
      readonly status: "confirmed" | "unverifiable" | "failed";
      readonly method: string;
      readonly ref: string | null;
      readonly timestamp: string;
    } | null = null;

    let dispatcherError: unknown = null;
    const humanDelay = ch.reply.resolveHumanDelayConfig(cfg, route.agentId);
    const { dispatcher, replyOptions, markDispatchIdle } =
      ch.reply.createReplyDispatcherWithTyping({
        humanDelay,
        typingCallbacks: { start: async () => {}, stop: async () => {} },
        deliver: async (deliverPayload: { text?: string }) => {
          const rawText = deliverPayload.text ?? "";
          const { userText, relayText } = splitReplyParts(rawText);
          const userDiag = diagnoseUserText(userText, relayText);
          if (userDiag) {
            this.log.warn(
              `${TAG} [user-quality] ${userDiag} (agent=${this.ctx.name}, hasRelay=${relayText != null}, userLen=${userText.length})`,
            );
          }

          const injection = matchHostTimeoutInjection(this.ctx, {
            channel: target.channel,
            traceId: params.metadata.trace_id,
            originalText: params.adapted_content,
          });
          const timeoutMs = injection?.timeout_ms ?? DEFAULT_HOST_DELIVERY_TIMEOUT_MS;
          const timestamp = new Date().toISOString();

          if (target.channel === "openclaw-weixin") {
            const plainText = this.weixinMods!.send.markdownToPlainText(userText);
            const sendOutcome = await withHostDeliveryTimeout(
              (async () => {
                if (injection?.mode === "hang_before_send") {
                  this.log.warn(`${TAG} [deliver-timeout] injected hang_before_send trace_id=${params.metadata.trace_id} channel=${target.channel} agent=${this.ctx.name}`);
                  return await new Promise<never>(() => {});
                }
                if (injection?.mode === "throw_before_send") {
                  this.log.warn(`${TAG} [deliver-timeout] injected throw_before_send trace_id=${params.metadata.trace_id} channel=${target.channel} agent=${this.ctx.name}`);
                  throw new Error(`Injected transient delivery failure before send trace_id=${params.metadata.trace_id}`);
                }
                try {
                  return {
                    kind: "ok" as const,
                    value: await this.weixinMods!.send.sendMessageWeixin({
                      to: target.to,
                      text: plainText,
                      opts: {
                        baseUrl: account!.baseUrl,
                        token: account!.token,
                        contextToken,
                      },
                    }),
                  };
                } catch (error) {
                  return { kind: "error" as const, error };
                }
              })(),
              timeoutMs,
            );

            if (sendOutcome === HOST_DELIVERY_TIMEOUT_SENTINEL) {
              recordUnverifiableDelivery(this.ctx, this.log, {
                traceId: params.metadata.trace_id,
                peer: params.metadata.sender_id,
                channel: target.channel,
                method: "timeout",
              });
              deliveryReceipt = {
                status: "unverifiable",
                method: "timeout",
                ref: null,
                timestamp,
              };
            } else if (sendOutcome.kind === "error") {
              throw sendOutcome.error;
            } else {
              recordUnverifiableDelivery(this.ctx, this.log, {
                traceId: params.metadata.trace_id,
                peer: params.metadata.sender_id,
                channel: target.channel,
                method: "weixin_api_accepted",
              });
              deliveryReceipt = {
                status: "unverifiable",
                method: "weixin_api_accepted",
                ref: sendOutcome.value.messageId ?? null,
                timestamp,
              };
            }
          } else {
            const chatId = target.to.replace(/^telegram:/, "");
            const sendOutcome = await withHostDeliveryTimeout(
              (async () => {
                if (injection?.mode === "hang_before_send") {
                  this.log.warn(`${TAG} [deliver-timeout] injected hang_before_send trace_id=${params.metadata.trace_id} channel=${target.channel} agent=${this.ctx.name}`);
                  return await new Promise<never>(() => {});
                }
                if (injection?.mode === "throw_before_send") {
                  this.log.warn(`${TAG} [deliver-timeout] injected throw_before_send trace_id=${params.metadata.trace_id} channel=${target.channel} agent=${this.ctx.name}`);
                  throw new Error(`Injected transient delivery failure before send trace_id=${params.metadata.trace_id}`);
                }
                try {
                  await sendTelegramMessage(telegramBotToken!, chatId, userText);
                  return { kind: "ok" as const };
                } catch (error) {
                  return { kind: "error" as const, error };
                }
              })(),
              timeoutMs,
            );

            if (sendOutcome === HOST_DELIVERY_TIMEOUT_SENTINEL) {
              recordUnverifiableDelivery(this.ctx, this.log, {
                traceId: params.metadata.trace_id,
                peer: params.metadata.sender_id,
                channel: target.channel,
                method: "timeout",
              });
              deliveryReceipt = {
                status: "unverifiable",
                method: "timeout",
                ref: null,
                timestamp,
              };
            } else if (sendOutcome.kind === "error") {
              throw sendOutcome.error;
            } else {
              recordUnverifiableDelivery(this.ctx, this.log, {
                traceId: params.metadata.trace_id,
                peer: params.metadata.sender_id,
                channel: target.channel,
                method: "telegram_api_accepted",
              });
              deliveryReceipt = {
                status: "unverifiable",
                method: "telegram_api_accepted",
                ref: null,
                timestamp,
              };
            }
          }

          if (relayText && this.replyCallback) {
            this.replyCallback({
              route_key: params.route_key,
              reply_text: relayText,
              inbound_trace_id: params.metadata.trace_id,
            });
          }
        },
        onError: (err: unknown) => {
          dispatcherError = err;
          this.log.error(`${TAG} deliver error: ${err}`);
        },
      });

    try {
      await ch.reply.withReplyDispatcher({
        dispatcher,
        run: () =>
          ch.reply.dispatchReplyFromConfig({
            ctx: finalized,
            cfg,
            dispatcher,
            replyOptions,
          }),
      });
    } finally {
      markDispatchIdle();
    }

    if (deliveryReceipt !== null) {
      return deliveryReceipt;
    }

    if (dispatcherError !== null) {
      throw dispatcherError;
    }

    return {
      status: "failed",
      method: target.channel,
      ref: null,
      timestamp: new Date().toISOString(),
    };
  }
}

async function onGatewayStart(log: Logger): Promise<void> {
  liveRuntimeByAgentName.clear();
  const configs = loadAgentConfigs(log);
  if (configs.length === 0) {
    log.warn(`${TAG} no valid agent configs found, bridge disabled`);
    return;
  }

  const modules = await loadRuntimeModules(log);
  if (!modules) {
    log.error(`${TAG} V2 runtime unavailable, bridge disabled`);
    return;
  }

  const weixinProbe = await probeWeixinDeps(log);
  const weixinMods = weixinProbe.ok ? weixinProbe.modules! : null;
  if (weixinMods) {
    log.info(`${TAG} WeChat channel adapter: available`);
  } else {
    log.info(`${TAG} WeChat channel adapter: unavailable (${weixinProbe.reason})`);
  }
  log.info(`${TAG} Telegram channel adapter: available (built-in)`);

  for (const config of configs) {
    const ctx = createAgentRuntimeContext(config);
    ensureAgentDirs(ctx);
    const catchupTimeoutInjection = matchHubCatchupTimeoutInjection(ctx);

    const stateManager = new modules.DurableStateManager(ctx.stateDir, ctx.config.agent_id);
    const hubClient = new modules.HubClient(ctx.config.hub_url);
    if (catchupTimeoutInjection) {
      const timeoutMs = Math.max(1, catchupTimeoutInjection.timeout_ms ?? 100);
      const originalFetchHistory =
        typeof hubClient.fetchHistory === "function"
          ? hubClient.fetchHistory.bind(hubClient)
          : null;
      if (originalFetchHistory) {
        log.warn(
          `${TAG} [${ctx.name}] [catchup-timeout] injecting fetchHistory timeout timeoutMs=${timeoutMs}`,
        );
        hubClient.fetchHistory = async (...args: unknown[]) => {
          void args;
          await new Promise((resolve) => setTimeout(resolve, timeoutMs));
          throw new Error(`Injected Hub catchup timeout after ${timeoutMs}ms`);
        };
      }
    }
    const hostAdapter = new OpenClawHostAdapter(ctx, pluginApi!, log, weixinMods);
    const inboundPipeline = new modules.InboundPipeline(
      stateManager,
      hostAdapter,
      {
        localAgentId: ctx.config.agent_id,
        localCulture: ctx.config.culture ?? "en",
      },
      (msg: string) => log.warn(`${TAG} [${ctx.name}] ${msg}`),
    );
    const outboundPipeline = new modules.OutboundPipeline(stateManager, {
      localAgentId: ctx.config.agent_id,
      localCulture: ctx.config.culture ?? "en",
    });
    liveRuntimeByAgentName.set(ctx.name, {
      outboundPipeline,
      hubClient,
      config: ctx.config,
    });
    const recoveryEngine = new modules.RecoveryEngine(
      {
        agentId: ctx.config.agent_id,
        apiKey: ctx.config.api_key,
        maxCatchupRetries: catchupTimeoutInjection?.max_retries,
      },
      (msg: string) => log.warn(`${TAG} [${ctx.name}] ${msg}`),
    );

    hostAdapter.onReplyDetected((params) => {
      void (async () => {
        try {
          const result = await outboundPipeline.relayReply(
            params.route_key,
            params.reply_text,
            params.inbound_trace_id,
            hubClient,
            ctx.config.api_key,
          );
          log.info(`${TAG} outbound relay OK: trace_id=${result.trace_id} route_key=${params.route_key}`);
        } catch (err) {
          log.error(`${TAG} outbound relay error (${ctx.name}): ${String(err)}`);
        }
      })();
    });

    try {
      await recoveryEngine.recover(
        stateManager,
        inboundPipeline,
        outboundPipeline,
        hubClient,
        hostAdapter,
        (event: unknown) => {
          void inboundPipeline.processMessage(event).catch((err: unknown) => {
            log.error(`${TAG} [${ctx.name}] inbound process failed: ${String(err)}`);
          });
        },
      );
      log.info(`${TAG} [${ctx.name}] V2 bridge active (state: ${ctx.stateDir})`);
    } catch (err) {
      log.error(`${TAG} [${ctx.name}] V2 startup FAILED: ${String(err)}`);
    }
  }
}

export default function register(api: any): void {
  if (!existsSync(AGENTS_DIR) && !existsSync(CONFIG_PATH)) {
    api.logger.warn(`${TAG} no agent configs found (checked ${AGENTS_DIR} and ${CONFIG_PATH}), bridge disabled`);
    return;
  }

  pluginApi = api;

  api.on("before_prompt_build", (event: unknown, hookCtx: unknown) => {
    const latestUserText = extractLatestUserText(
      event as { readonly prompt?: string; readonly messages?: readonly unknown[] },
    );
    const isContinuation = isContinuationRequest(latestUserText);
    const activePeer = loadActivePeerFromDurableState(
      (hookCtx as { readonly agentId?: string } | undefined)?.agentId,
      (hookCtx as { readonly sessionKey?: string } | undefined)?.sessionKey,
      { preferRemotePeer: true },
    );
    const injection = buildChorusRouterInjection(
      event as { readonly prompt?: string; readonly messages?: readonly unknown[] },
      hookCtx as { readonly agentId?: string; readonly sessionKey?: string },
      activePeer,
    );
    const sessionRef = continuationSessionKey(
      (hookCtx as { readonly agentId?: string } | undefined)?.agentId,
      (hookCtx as { readonly sessionKey?: string } | undefined)?.sessionKey,
    );
    if (sessionRef) {
      if (isContinuation && activePeer?.routeKey) {
        pendingContinuationBySession.set(sessionRef, {
          routeKey: activePeer.routeKey,
          peerId: activePeer.peerId,
        });
      } else {
        pendingContinuationBySession.delete(sessionRef);
      }
    }
    if (!injection) return;
    api.logger.info(`${TAG} before_prompt_build injected Chorus router context (agent=${(hookCtx as { readonly agentId?: string } | undefined)?.agentId ?? "?"}, activePeer=${activePeer?.peerId ?? "none"})`);
    return injection;
  });

  api.on("agent_end", (event: unknown, hookCtx: unknown) => {
    const messages = (event as { readonly messages?: readonly unknown[] } | undefined)?.messages;
    if (!Array.isArray(messages)) return;

    const sessionKey = (hookCtx as { readonly sessionKey?: string } | undefined)?.sessionKey;
    if (isChorusSession(sessionKey)) return;

    const latestUserText = extractLatestUserText({
      messages,
    });
    if (!isContinuationRequest(latestUserText)) return;

    const sessionRef = continuationSessionKey(
      (hookCtx as { readonly agentId?: string } | undefined)?.agentId,
      sessionKey,
    );
    const cachedTurn = sessionRef ? pendingContinuationBySession.get(sessionRef) ?? null : null;
    if (sessionRef) {
      pendingContinuationBySession.delete(sessionRef);
    }
    if (!cachedTurn?.routeKey) {
      api.logger.warn(`${TAG} agent_end continuation skipped: no cached route for this turn`);
      return;
    }

    const turnUsesTools = latestTurnUsesTools(messages);
    const assistantText = extractLatestAssistantText(messages);
    if (turnUsesTools) {
      api.logger.error(
        `${TAG} agent_end continuation blocked: tool/manual-send detected in continuation turn`,
      );
      return;
    }
    const explicitReplyText = extractContinuationReplyBody(latestUserText);
    const replyText = explicitReplyText ?? assistantText;
    if (!replyText) {
      api.logger.warn(
        `${TAG} agent_end continuation skipped: no valid remote-facing body (tool_use=${turnUsesTools ? "yes" : "no"})`,
      );
      return;
    }

    const agentName = normalizeHookAgentName(
      (hookCtx as { readonly agentId?: string } | undefined)?.agentId,
    );
    if (!agentName) return;
    const runtime = liveRuntimeByAgentName.get(agentName);
    if (!runtime) {
      api.logger.warn(`${TAG} agent_end continuation skipped: runtime missing for agent=${agentName}`);
      return;
    }

    void (async () => {
      try {
        const result = await runtime.outboundPipeline.relayReply(
          cachedTurn.routeKey,
          replyText,
          null,
          runtime.hubClient,
          runtime.config.api_key,
        );
        api.logger.info(
          `${TAG} main-session continuation relay OK: trace_id=${result.trace_id} route_key=${cachedTurn.routeKey} remote_peer=${cachedTurn.peerId}`,
        );
      } catch (err) {
        api.logger.error(`${TAG} main-session continuation relay FAILED: ${String(err)}`);
      }
    })();
  });

  api.on("gateway_start", async () => {
    try {
      await onGatewayStart(api.logger);
    } catch (err) {
      api.logger.error(`${TAG} gateway_start handler FAILED: ${err}`);
      console.error(`${TAG} gateway_start handler FAILED:`, err);
    }
  });

  api.logger.info(`${TAG} registered, waiting for gateway_start`);
}
