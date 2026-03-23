/**
 * chorus-bridge — OpenClaw plugin: Chorus Hub ↔ OpenClaw runtime bridge.
 *
 * Multi-agent: reads per-agent configs from ~/.chorus/agents/*.json.
 * Each agent gets its own SSE connection, state directory, and delivery path.
 * State is per-agent: ~/.chorus/state/{agentName}/{cursor,seen,inbox,history}.
 * Delivery is channel-agnostic: routes via deliveryContext.channel.
 * Culture prefs are config-driven: no hardcoded agent→culture table.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

import { buildTrustBoundary } from "./guard.ts";
import {
  resolveDeliveryTargetFromSessions,
  resolveReceiverPrefs,
  primarySubtag,
  splitReplyParts,
  diagnoseUserText,
  deriveChorusSessionKey,
} from "./resolve.ts";
import type { DeliveryTarget, ReceiverPrefs } from "./resolve.ts";
import { relayToHub } from "./relay.ts";
import { buildChorusRouterInjection } from "./router-hook.ts";

// === Constants ===

const CHORUS_DIR = join(homedir(), ".chorus");
const AGENTS_DIR = join(CHORUS_DIR, "agents");
// Resolve chorus project root from this template's location (packages/chorus-skill/templates/bridge/)
const CHORUS_PROJECT = resolve(__dirname, "..", "..", "..", "..");
const OPENCLAW_DIR = join(homedir(), ".openclaw");
const WEIXIN_SRC = join(OPENCLAW_DIR, "extensions", "openclaw-weixin", "src");
const WEIXIN_DIR = join(OPENCLAW_DIR, "extensions", "openclaw-weixin");
const CONFIG_PATH = join(CHORUS_DIR, "config.json");
const MAX_SEEN = 1000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RELAY_TURNS = 20;
const TAG = "[chorus-bridge]";

// === Types ===

type ChorusConfig = {
  readonly agent_id: string;
  readonly api_key: string;
  readonly hub_url: string;
  readonly culture?: string;
  readonly preferred_language?: string;
};

type SSEPayload = {
  readonly trace_id: string;
  readonly sender_id: string;
  readonly envelope: Record<string, unknown>;
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

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

// Per-agent runtime context — all mutable state is scoped here, not module-level.
type AgentContext = {
  readonly config: ChorusConfig;
  readonly name: string;
  readonly stateDir: string;
  readonly seen: Set<string>;
  retryInFlight: boolean;
  drainScheduled: boolean;
};

type ActiveChorusPeer = {
  readonly peerId: string;
  readonly peerLabel: string;
  readonly conversationId: string | null;
  readonly updatedAt: string;
};

function createAgentContext(config: ChorusConfig): AgentContext {
  const name = config.agent_id.split("@")[0];
  return {
    config,
    name,
    stateDir: join(CHORUS_DIR, "state", name),
    seen: new Set(),
    retryInFlight: false,
    drainScheduled: false,
  };
}

// === Multi-Agent Config Loader ===

function loadAgentConfigs(log: Logger): ChorusConfig[] {
  const configs: ChorusConfig[] = [];

  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
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

// === Telegram Bot API Delivery ===

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

// === Module State (shared across agents) ===

let pluginApi: {
  config: Record<string, unknown>;
  runtime: { channel: Record<string, any> };
  logger: Logger;
} | null = null;
let weixinMods: WeixinModules | null = null;
let envelopeSchema: { safeParse: (v: unknown) => { success: boolean; data?: any; error?: { message: string } } } | null = null;

// === Import Helper ===

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
      const jiti = (createJiti as any)(import.meta.url, {
        interopDefault: true,
        extensions: [".ts", ".tsx", ".mts", ".js", ".mjs"],
        alias: { "openclaw/plugin-sdk": sdkAlias },
      });
      log.info(`${TAG} jiti loaded from ${pkgRoot}`);
      return (s: string) => jiti.import(s);
    } catch (err) {
      log.info(`${TAG} jiti load failed from ${pkgRoot}: ${err}`);
    }
  }

  try {
    const { createJiti } = await import("jiti");
    const jiti = (createJiti as any)(import.meta.url, {
      interopDefault: true,
      extensions: [".ts", ".tsx", ".mts", ".js", ".mjs"],
    });
    log.info(`${TAG} jiti from process context (no SDK alias)`);
    return (s: string) => jiti.import(s);
  } catch {
    /* fall through */
  }

  log.info(`${TAG} jiti not available, using native import`);
  return (s: string) => import(s);
}

// === Protocol-level probe: envelope schema (required) ===

async function probeEnvelopeSchema(
  log: Logger,
): Promise<typeof envelopeSchema> {
  const importFn = await buildImportFn(log);
  const extensions = [".ts", ".js", ""];

  for (const ext of extensions) {
    try {
      const types = await importFn(
        join(CHORUS_PROJECT, "src", "shared", "types" + ext),
      );
      if (typeof types.ChorusEnvelopeSchema?.safeParse === "function") {
        log.info(`${TAG} ChorusEnvelopeSchema loaded (ext=${ext})`);
        return types.ChorusEnvelopeSchema;
      }
    } catch {
      continue;
    }
  }

  log.warn(`${TAG} ChorusEnvelopeSchema unavailable`);
  return null;
}

// === Channel adapter probe: WeChat (optional) ===

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
      const mod = await importFn(inboundPath);
      if (typeof mod.getContextToken !== "function") continue;

      const accountsMod = await importFn(
        join(WEIXIN_SRC, "auth", "accounts" + ext),
      );
      if (typeof accountsMod.resolveWeixinAccount !== "function") continue;

      const sendMod = await importFn(
        join(WEIXIN_SRC, "messaging", "send" + ext),
      );
      if (typeof sendMod.sendMessageWeixin !== "function") continue;
      if (typeof sendMod.markdownToPlainText !== "function") continue;

      return {
        ok: true,
        modules: { accounts: accountsMod, inbound: mod, send: sendMod },
      };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "weixin module imports failed" };
}

// === File Helpers ===

function readJSON(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function writeJSON(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

// === Per-Agent State (all scoped to ctx.stateDir) ===

function ensureAgentDirs(ctx: AgentContext): void {
  mkdirSync(join(ctx.stateDir, "inbox"), { recursive: true });
  mkdirSync(join(ctx.stateDir, "history"), { recursive: true });
}

function loadSeen(ctx: AgentContext): void {
  const arr = readJSON(join(ctx.stateDir, "seen.json"));
  if (Array.isArray(arr)) {
    for (const id of arr) ctx.seen.add(id);
  }
}

function saveSeen(ctx: AgentContext): void {
  const arr = [...ctx.seen];
  writeJSON(
    join(ctx.stateDir, "seen.json"),
    arr.length > MAX_SEEN ? arr.slice(arr.length - MAX_SEEN) : arr,
  );
}

function loadCursor(ctx: AgentContext): number {
  const data = readJSON(join(ctx.stateDir, "cursor.json")) as { last_seen_id?: number } | null;
  return data?.last_seen_id ?? 0;
}

function saveCursor(ctx: AgentContext, id: number): void {
  writeJSON(join(ctx.stateDir, "cursor.json"), { last_seen_id: id });
}

function saveToInbox(ctx: AgentContext, traceId: string, payload: SSEPayload): void {
  writeJSON(join(ctx.stateDir, "inbox", `${traceId}.json`), payload);
}

function removeFromInbox(ctx: AgentContext, traceId: string): void {
  try {
    unlinkSync(join(ctx.stateDir, "inbox", `${traceId}.json`));
  } catch {
    /* OK — already removed */
  }
}

function listInbox(ctx: AgentContext): Array<{ traceId: string; payload: SSEPayload }> {
  try {
    const dir = join(ctx.stateDir, "inbox");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        traceId: f.replace(".json", ""),
        payload: readJSON(join(dir, f)) as SSEPayload,
      }))
      .filter((x) => x.payload);
  } catch {
    return [];
  }
}

function appendHistory(
  ctx: AgentContext,
  senderId: string,
  entry: Record<string, unknown>,
): void {
  const safe = senderId.replace(/[^a-zA-Z0-9@._-]/g, "_");
  appendFileSync(
    join(ctx.stateDir, "history", `${safe}.jsonl`),
    JSON.stringify(entry) + "\n",
    "utf-8",
  );
}

function saveActiveChorusPeer(
  ctx: AgentContext,
  peerId: string,
  conversationId: string | null,
): void {
  writeJSON(join(ctx.stateDir, "active-peer.json"), {
    peerId,
    peerLabel: peerId.split("@")[0] || peerId,
    conversationId,
    updatedAt: new Date().toISOString(),
  });
}

function discoverActiveChorusPeerFromStateDir(stateDir: string): ActiveChorusPeer | null {
  const historyDir = join(stateDir, "history");
  try {
    const files = readdirSync(historyDir).filter((f) => f.endsWith(".jsonl"));
    let best: ActiveChorusPeer | null = null;
    let bestTs = "";

    for (const file of files) {
      const fullPath = join(historyDir, file);
      const raw = readFileSync(fullPath, "utf-8");
      const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          const row = JSON.parse(lines[i]) as Record<string, unknown>;
          const peerId = typeof row.peer === "string" ? row.peer : null;
          const ts = typeof row.ts === "string" ? row.ts : null;
          if (!peerId || !ts) continue;
          if (!best || ts > bestTs) {
            const envelope = row.envelope && typeof row.envelope === "object"
              ? row.envelope as Record<string, unknown>
              : null;
            best = {
              peerId,
              peerLabel: peerId.split("@")[0] || peerId,
              conversationId: typeof envelope?.conversation_id === "string"
                ? envelope.conversation_id
                : null,
              updatedAt: ts,
            };
            bestTs = ts;
          }
          break;
        } catch {
          continue;
        }
      }
    }
    return best;
  } catch {
    return null;
  }
}

function loadActiveChorusPeerByAgentId(agentId: string | undefined): ActiveChorusPeer | null {
  if (!agentId || typeof agentId !== "string") return null;
  const name = agentId.split("@")[0];
  const stateDir = join(CHORUS_DIR, "state", name);
  const raw = readJSON(join(stateDir, "active-peer.json"));
  if (raw && typeof raw === "object") {
    const peer = raw as Record<string, unknown>;
    if (typeof peer.peerId === "string" && peer.peerId) {
      return {
        peerId: peer.peerId,
        peerLabel: typeof peer.peerLabel === "string" && peer.peerLabel
          ? peer.peerLabel
          : peer.peerId.split("@")[0],
        conversationId: typeof peer.conversationId === "string" ? peer.conversationId : null,
        updatedAt: typeof peer.updatedAt === "string" ? peer.updatedAt : new Date(0).toISOString(),
      };
    }
  }

  const discovered = discoverActiveChorusPeerFromStateDir(stateDir);
  if (discovered) {
    writeJSON(join(stateDir, "active-peer.json"), discovered);
  }
  return discovered;
}

// === Schema Validation ===

function validateSSEPayload(raw: unknown, log: Logger): SSEPayload | null {
  if (!raw || typeof raw !== "object") {
    log.warn(`${TAG} [validate] payload is not an object`);
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const { trace_id, sender_id, envelope } = obj;
  if (typeof trace_id !== "string" || !trace_id) {
    log.warn(`${TAG} [validate] missing or invalid trace_id`);
    return null;
  }
  if (typeof sender_id !== "string" || !sender_id) {
    log.warn(`${TAG} [validate] missing or invalid sender_id (trace_id=${trace_id})`);
    return null;
  }

  const result = envelopeSchema!.safeParse(envelope);
  if (!result.success) {
    log.warn(`${TAG} [validate] invalid envelope trace_id=${trace_id}: ${result.error?.message}`);
    return null;
  }

  return { trace_id, sender_id, envelope: result.data };
}

// === Delivery Target Resolution ===

function resolveDeliveryTarget(agentName: string): DeliveryTarget | null {
  const sessionsPath = join(
    OPENCLAW_DIR, "agents", agentName, "sessions", "sessions.json",
  );
  const sessions = readJSON(sessionsPath) as Record<string, any> | null;
  return resolveDeliveryTargetFromSessions(sessions, agentName);
}

// === Message Processing Pipeline ===

async function processMessage(
  payload: SSEPayload,
  ctx: AgentContext,
  log: Logger,
): Promise<boolean> {
  const { trace_id, envelope } = payload;
  const ch = pluginApi!.runtime.channel;
  const cfg = pluginApi!.config;

  log.info(`${TAG} [process] START trace_id=${trace_id} sender=${payload.sender_id} agent=${ctx.name}`);

  // ④ resolveDeliveryTarget
  const target = resolveDeliveryTarget(ctx.name);
  if (!target) {
    log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_delivery_target agent=${ctx.name}`);
    return false;
  }

  // ⑤ resolveAgentRoute (channel-aware)
  const route = ch.routing.resolveAgentRoute({
    cfg,
    channel: target.channel,
    accountId: target.accountId,
    peer: { kind: "direct", id: target.to },
  });
  if (!route.agentId) {
    log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_agent_route target=${target.to} agent=${ctx.name}`);
    return false;
  }

  // Channel-specific pre-checks
  let contextToken: string | undefined;
  let account: { baseUrl: string; token?: string } | undefined;
  let telegramBotToken: string | null = null;

  if (target.channel === "openclaw-weixin") {
    if (!weixinMods) {
      log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=wx_adapter_unavailable agent=${ctx.name}`);
      return false;
    }
    contextToken = weixinMods.inbound.getContextToken(target.accountId, target.to);
    if (!contextToken) {
      log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_context_token to=${target.to} accountId=${target.accountId} agent=${ctx.name}`);
      return false;
    }
    account = weixinMods.accounts.resolveWeixinAccount(cfg, target.accountId);
    if (!account?.baseUrl) {
      log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_wx_base_url accountId=${target.accountId} agent=${ctx.name}`);
      return false;
    }
    log.info(`${TAG} [process] wx pre-check OK trace_id=${trace_id} to=${target.to} agent=${ctx.name}`);
  } else if (target.channel === "telegram") {
    telegramBotToken = resolveTelegramBotToken(target.accountId);
    if (!telegramBotToken) {
      log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_tg_bot_token accountId=${target.accountId} agent=${ctx.name}`);
      return false;
    }
    log.info(`${TAG} [process] tg pre-check OK trace_id=${trace_id} agent=${ctx.name}`);
  } else {
    log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=unsupported_channel channel=${target.channel} agent=${ctx.name}`);
    return false;
  }

  // ⑥ buildMsgContext — culture from config, not hardcoded table
  const receiverPrefs = resolveReceiverPrefs(ctx.config);
  if (!receiverPrefs) {
    log.warn(`${TAG} [process] FAIL trace_id=${trace_id} reason=no_culture_config agent=${ctx.name}`);
    return false;
  }
  const senderCulture = (envelope.sender_culture as string) ?? "unknown";
  const mustAdapt = primarySubtag(senderCulture) !== primarySubtag(receiverPrefs.preferredLanguage);

  // CONTEXT DIAGNOSTICS: print full agent context for every processed message.
  // When agent context/config mixing occurs (e.g. zh-CN agent showing en culture),
  // this log line makes the mismatch visible in a single grep.
  log.info(
    `${TAG} [context] agent=${ctx.name} agent_id=${ctx.config.agent_id} sender=${payload.sender_id} channel=${target.channel} culture=${receiverPrefs.culture} lang=${receiverPrefs.preferredLanguage} senderCulture=${senderCulture} mustAdapt=${mustAdapt}`,
  );

  // SECURITY: build trust boundary — remote content enters message
  // handling plane ONLY, never tool execution plane. See guard.ts.
  const trust = buildTrustBoundary((envelope.original_text as string) ?? "");

  // SESSION ISOLATION: Chorus inbound messages use a dedicated session key,
  // NOT the user main session (route.sessionKey / route.mainSessionKey).
  //
  // WHY: reply_format injects [chorus_reply] marker into session context.
  // If chorus shares the user main session, that marker persists and ALL
  // subsequent normal user messages produce [chorus_reply] output —
  // which normal Telegram/WeChat delivery leaks raw to the user.
  //
  // The chorus session key is deterministic per (agent, peer, conversation),
  // so the same remote agent's messages always land in the same session.
  const chorusSessionKey = deriveChorusSessionKey(
    ctx.name,
    envelope.sender_id as string,
    (envelope.conversation_id as string) ?? null,
  );
  log.info(`${TAG} [session] chorus="${chorusSessionKey}" user="${route.sessionKey}" (isolated)`);

  // DISPATCH ROUTING: OriginatingChannel and Provider are set to "chorus-bridge"
  // (NOT the real channel like "telegram" or "openclaw-weixin").
  //
  // Why: If we set OriginatingChannel to the real channel, OpenClaw's built-in
  // channel handler takes over reply delivery, bypassing our custom deliver
  // callback. By using "chorus-bridge" (not a real channel plugin), OpenClaw
  // has no built-in handler and falls through to our dispatcher — which runs
  // splitReplyParts, user-quality checks, channel delivery, and outbound relay.
  //
  // The real channel is preserved in target.channel (for our deliver callback
  // to route correctly).
  const chorusPayload = {
      _type: "chorus_inbound",
      ...trust,
      sender_id: envelope.sender_id,
      sender_culture: senderCulture,
      cultural_context: envelope.cultural_context ?? null,
      conversation_id: envelope.conversation_id ?? null,
      turn_number: envelope.turn_number ?? null,
      receiver_culture: receiverPrefs.culture,
      receiver_preferred_language: receiverPrefs.preferredLanguage,
      must_adapt: mustAdapt,
      adaptation_instruction: mustAdapt
        ? `CRITICAL: The receiver's language is ${receiverPrefs.preferredLanguage}. You MUST translate/adapt the message into ${receiverPrefs.preferredLanguage} before delivering. Do NOT forward the original ${senderCulture} text as-is. Output ONLY in ${receiverPrefs.preferredLanguage}.`
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
      ? `You MUST rewrite the user-facing part into ${receiverPrefs.preferredLanguage}. Do NOT transparently forward the remote agent's original ${senderCulture} text to the user.`
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

  const ctx_msg: Record<string, unknown> = {
    Body: chorusPreamble,
    From: target.to,
    To: target.to,
    AccountId: target.accountId,
    OriginatingChannel: "chorus-bridge",
    OriginatingTo: target.to,
    MessageSid: `chorus-${trace_id}`,
    Timestamp: Date.now(),
    Provider: "chorus-bridge",
    ChatType: "direct",
    SessionKey: chorusSessionKey,
  };

  // ⑦ recordInboundSession — uses chorusSessionKey, NOT route.sessionKey.
  // updateLastRoute also targets the chorus session, so the user main
  // session's "last active channel" is never overwritten by chorus traffic.
  const storePath = ch.session.resolveStorePath(
    (cfg as any).session?.store,
    { agentId: route.agentId },
  );
  const finalized = ch.reply.finalizeInboundContext(ctx_msg);

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
      log.error(`${TAG} recordInboundSession: ${err}`),
  });

  // ⑧-⑨ dispatchReplyFromConfig + deliver callback
  log.info(`${TAG} [dispatch] ctx.OriginatingChannel=${ctx_msg.OriginatingChannel} ctx.Provider=${ctx_msg.Provider} realChannel=${target.channel} agent=${ctx.name}`);
  //
  // SECURITY INVARIANT — MESSAGE PLANE ONLY
  // ctx_msg.Body carries chorus_inbound with:
  //   trust_level          = "remote_untrusted"
  //   allow_local_control  = false
  //   allow_tool_execution = false
  //   allow_side_effects   = false
  //
  // OK: display to the user, translate/adapt, send protocol replies
  // BLOCKED: shell exec, file I/O, system control, destructive ops
  const humanDelay = ch.reply.resolveHumanDelayConfig(cfg, route.agentId);
  const { dispatcher, replyOptions, markDispatchIdle } =
    ch.reply.createReplyDispatcherWithTyping({
      humanDelay,
      typingCallbacks: { start: async () => {}, stop: async () => {} },
      deliver: async (deliverPayload: { text?: string }) => {
        const rawText = deliverPayload.text ?? "";
        const { userText, relayText } = splitReplyParts(rawText);

        // Quality check: is userText actually a user-facing message?
        const userDiag = diagnoseUserText(userText, relayText);
        if (userDiag) {
          log.warn(`${TAG} [user-quality] ${userDiag} (agent=${ctx.name}, hasRelay=${relayText != null}, userLen=${userText.length})`);
        }

        log.info(`${TAG} [split] raw=${rawText.length} user=${userText.length} relay=${relayText?.length ?? 0} hasMarker=${relayText != null}`);

        // Step 1: Deliver user-facing part to the local channel.
        // This always happens — "autonomy does not mean secrecy."
        const channelText = userText;
        if (target.channel === "openclaw-weixin") {
          const plainText = weixinMods!.send.markdownToPlainText(channelText);
          log.info(`${TAG} [wx-deliver] sending (to=${target.to}, len=${plainText.length})`);
          try {
            const result = await weixinMods!.send.sendMessageWeixin({
              to: target.to,
              text: plainText,
              opts: {
                baseUrl: account!.baseUrl,
                token: account!.token,
                contextToken,
              },
            });
            log.info(`${TAG} [wx-deliver] OK (to=${target.to}, messageId=${result?.messageId ?? "?"})`);
          } catch (wxErr) {
            log.error(`${TAG} [wx-deliver] FAIL (to=${target.to}): ${wxErr}`);
            throw wxErr;
          }
        } else if (target.channel === "telegram") {
          const chatId = target.to.replace(/^telegram:/, "");
          log.info(`${TAG} [tg-deliver] sending (chatId=${chatId}, len=${channelText.length})`);
          try {
            await sendTelegramMessage(telegramBotToken!, chatId, channelText);
            log.info(`${TAG} [tg-deliver] OK (chatId=${chatId})`);
          } catch (tgErr) {
            log.error(`${TAG} [tg-deliver] FAIL (chatId=${chatId}): ${tgErr}`);
            throw tgErr;
          }
        }

        // Step 2: If agent included [chorus_reply], relay that part to Hub.
        // relayText is null when agent omitted the marker (no reply to remote).
        // Relay errors are logged but do not fail the user delivery.
        if (relayText) {
          relayToHub(ctx.config, envelope, relayText, MAX_RELAY_TURNS)
            .then((result) => {
              if (result.ok && result.trace_id) {
                saveActiveChorusPeer(
                  ctx,
                  result.receiver_id!,
                  typeof result.envelope?.conversation_id === "string"
                    ? result.envelope.conversation_id
                    : null,
                );
                appendHistory(ctx, result.receiver_id!, {
                  ts: new Date().toISOString(),
                  dir: "sent",
                  trace_id: result.trace_id,
                  peer: result.receiver_id,
                  envelope: result.envelope,
                });
                log.info(`${TAG} outbound relay OK: trace_id=${result.trace_id} → ${result.receiver_id}`);
              } else {
                log.warn(`${TAG} outbound relay skipped: ${result.reason}`);
              }
            })
            .catch((err) => log.error(`${TAG} outbound relay error: ${err}`));
        }
      },
      onError: (err: unknown) => log.error(`${TAG} deliver error: ${err}`),
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

  // ⑩ write history
  appendHistory(ctx, payload.sender_id, {
    ts: new Date().toISOString(),
    dir: "inbound",
    trace_id,
    peer: payload.sender_id,
    envelope,
  });
  saveActiveChorusPeer(
    ctx,
    payload.sender_id,
    typeof envelope.conversation_id === "string" ? envelope.conversation_id : null,
  );

  // ⑪ delete inbox
  removeFromInbox(ctx, trace_id);
  log.info(`${TAG} [process] removed from inbox trace_id=${trace_id} (${ctx.name})`);

  // ⑫ mark seen
  ctx.seen.add(trace_id);
  saveSeen(ctx);
  log.info(`${TAG} [process] SUCCESS trace_id=${trace_id} sender=${payload.sender_id} agent=${ctx.name}`);

  // Auto-drain
  if (!ctx.retryInFlight && !ctx.drainScheduled && listInbox(ctx).length > 0) {
    ctx.drainScheduled = true;
    queueMicrotask(() => {
      ctx.drainScheduled = false;
      retryPending(ctx, log).catch((err) =>
        log.error(`${TAG} auto-drain error: ${err}`),
      );
    });
    log.info(`${TAG} auto-drain scheduled (inbox has pending)`);
  }

  return true;
}

// === SSE Stream Parser ===

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let dataLines: string[] = [];

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5));
        } else if (line === "" || line === "\r") {
          if (dataLines.length > 0) {
            yield { event: currentEvent, data: dataLines.join("\n").trim() };
          }
          currentEvent = "message";
          dataLines = [];
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// === SSE Connection with Reconnect Loop ===

async function startInbox(
  ctx: AgentContext,
  log: Logger,
): Promise<void> {
  let attempt = 0;

  for (;;) {
    const abort = new AbortController();
    const url = `${ctx.config.hub_url}/agent/inbox?token=${encodeURIComponent(ctx.config.api_key)}`;

    try {
      const response = await fetch(url, {
        headers: { Accept: "text/event-stream" },
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("no response body");

      log.info(`${TAG} [sse] connected hub=${ctx.config.hub_url} agent=${ctx.name} agent_id=${ctx.config.agent_id}`);
      attempt = 0;

      for await (const event of parseSSEStream(response.body)) {
        if (event.event === "connected") {
          log.info(`${TAG} SSE handshake OK (${ctx.name})`);
          continue;
        }
        if (event.event !== "message") {
          log.info(`${TAG} [sse-recv] non-message event="${event.event}" (${ctx.name})`);
          continue;
        }

        try {
          const raw = JSON.parse(event.data);
          log.info(`${TAG} [sse-recv] event received (${ctx.name}) raw_trace_id=${(raw as any)?.trace_id ?? "?"} raw_sender=${(raw as any)?.sender_id ?? "?"}`);

          const validated = validateSSEPayload(raw, log);
          if (!validated) {
            log.warn(`${TAG} [sse-recv] validation failed (${ctx.name}) raw_trace_id=${(raw as any)?.trace_id ?? "?"}`);
            continue;
          }
          if (ctx.seen.has(validated.trace_id)) {
            log.info(`${TAG} [sse-recv] already seen trace_id=${validated.trace_id} (${ctx.name})`);
            continue;
          }

          // SELF-SEND GUARD: skip messages we sent ourselves.
          if (validated.sender_id === ctx.config.agent_id) {
            log.warn(`${TAG} [self-send] skip trace_id=${validated.trace_id} agent=${ctx.config.agent_id} sender=${validated.sender_id}`);
            ctx.seen.add(validated.trace_id);
            saveSeen(ctx);
            continue;
          }

          log.info(`${TAG} [sse-recv] saving to inbox trace_id=${validated.trace_id} sender=${validated.sender_id} (${ctx.name})`);
          saveToInbox(ctx, validated.trace_id, validated);

          try {
            const ok = await processMessage(validated, ctx, log);
            if (!ok) {
              log.warn(`${TAG} [sse-recv] processMessage returned false trace_id=${validated.trace_id} (${ctx.name})`);
            }
          } catch (err) {
            log.error(`${TAG} [sse-recv] processMessage threw trace_id=${validated.trace_id} (${ctx.name}): ${err}`);
          }
        } catch (parseErr) {
          log.warn(`${TAG} [sse-recv] JSON parse error (${ctx.name}): ${parseErr}`);
        }
      }

      log.info(`${TAG} SSE stream ended (${ctx.name}), will reconnect`);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") {
        log.info(`${TAG} SSE aborted (${ctx.name})`);
        return;
      }
      log.error(`${TAG} SSE error (${ctx.name}): ${err}`);
    }

    attempt++;
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
    log.info(`${TAG} reconnecting in ${delay}ms (attempt ${attempt}, ${ctx.name})`);
    await new Promise((r) => setTimeout(r, delay));

    await catchUp(ctx, log);
    await retryPending(ctx, log);
  }
}

// === Catch-up from History API ===

async function catchUp(
  ctx: AgentContext,
  log: Logger,
): Promise<void> {
  const cursor = loadCursor(ctx);
  const url = `${ctx.config.hub_url}/agent/messages?since=${cursor}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ctx.config.api_key}` },
    });
    if (!response.ok) {
      log.warn(`${TAG} catch-up HTTP ${response.status}`);
      return;
    }

    const body = (await response.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = body.data ?? [];

    let maxId = cursor;
    let processed = 0;

    for (const row of rows) {
      const id = row.id as number;
      if (id > maxId) maxId = id;

      if (row.receiver_id !== ctx.config.agent_id) {
        log.info(`${TAG} [catch-up] skip id=${id} receiver=${row.receiver_id} not_me=${ctx.config.agent_id}`);
        continue;
      }

      const traceId = row.trace_id as string;
      log.info(`${TAG} [catch-up] row id=${id} trace_id=${traceId} sender=${row.sender_id} (${ctx.name})`);

      if (ctx.seen.has(traceId)) {
        log.info(`${TAG} [catch-up] already seen trace_id=${traceId} (${ctx.name})`);
        continue;
      }

      const validated = validateSSEPayload({
        trace_id: traceId,
        sender_id: row.sender_id,
        envelope: row.envelope,
      }, log);
      if (!validated) {
        log.warn(`${TAG} [catch-up] validation failed trace_id=${traceId} (${ctx.name})`);
        continue;
      }

      // SELF-SEND GUARD (catch-up path): same logic as SSE path.
      if (validated.sender_id === ctx.config.agent_id) {
        log.warn(`${TAG} [self-send] skip trace_id=${traceId} agent=${ctx.config.agent_id} sender=${validated.sender_id}`);
        ctx.seen.add(traceId);
        saveSeen(ctx);
        continue;
      }

      log.info(`${TAG} [catch-up] saving to inbox trace_id=${traceId} sender=${validated.sender_id} (${ctx.name})`);
      saveToInbox(ctx, traceId, validated);
      try {
        const ok = await processMessage(validated, ctx, log);
        if (ok) {
          processed++;
        } else {
          log.warn(`${TAG} [catch-up] processMessage returned false trace_id=${traceId} (${ctx.name})`);
        }
      } catch (err) {
        log.error(`${TAG} [catch-up] processMessage threw trace_id=${traceId} (${ctx.name}): ${err}`);
      }
    }

    if (maxId > cursor) saveCursor(ctx, maxId);
    log.info(`${TAG} catch-up (${ctx.name}): ${rows.length} rows, ${processed} processed, cursor=${maxId}`);
  } catch (err) {
    log.error(`${TAG} catch-up error (${ctx.name}): ${err}`);
  }
}

// === Retry Pending Inbox ===

async function retryPending(
  ctx: AgentContext,
  log: Logger,
): Promise<void> {
  if (ctx.retryInFlight) {
    log.info(`${TAG} retryPending skipped (${ctx.name}, already in flight)`);
    return;
  }
  ctx.retryInFlight = true;

  try {
    const pending = listInbox(ctx);
    if (pending.length === 0) return;

    log.info(`${TAG} retrying ${pending.length} pending (${ctx.name})`);
    let ok = 0;

    for (const { traceId, payload } of pending) {
      if (ctx.seen.has(traceId)) {
        removeFromInbox(ctx, traceId);
        continue;
      }
      try {
        if (await processMessage(payload, ctx, log)) ok++;
      } catch (err) {
        log.error(`${TAG} retry trace_id=${traceId}: ${err}`);
      }
    }

    log.info(`${TAG} retry (${ctx.name}): ${ok}/${pending.length} succeeded`);
  } finally {
    ctx.retryInFlight = false;
  }
}

// === Gateway Start Handler ===

async function onGatewayStart(log: Logger): Promise<void> {
  const configs = loadAgentConfigs(log);
  if (configs.length === 0) {
    log.warn(`${TAG} no valid agent configs found, bridge disabled`);
    return;
  }

  // Protocol-level probe (required)
  envelopeSchema = await probeEnvelopeSchema(log);
  if (!envelopeSchema) {
    log.warn(`${TAG} envelope schema unavailable, bridge disabled`);
    return;
  }

  // Channel adapter probes (optional — each channel fails independently)
  const weixinProbe = await probeWeixinDeps(log);
  if (weixinProbe.ok) {
    weixinMods = weixinProbe.modules!;
    log.info(`${TAG} WeChat channel adapter: available`);
  } else {
    log.info(`${TAG} WeChat channel adapter: unavailable (${weixinProbe.reason})`);
  }
  log.info(`${TAG} Telegram channel adapter: available (built-in)`);

  // Per-agent startup
  for (const config of configs) {
    const ctx = createAgentContext(config);
    ensureAgentDirs(ctx);
    loadSeen(ctx);

    await catchUp(ctx, log);
    await retryPending(ctx, log);

    startInbox(ctx, log).catch((err) => {
      log.error(`${TAG} [${ctx.name}] SSE loop fatal: ${err}`);
    });

    log.info(`${TAG} [${ctx.name}] bridge active (state: ${ctx.stateDir})`);
  }
}

// === Plugin Entry ===

export default function register(api: any): void {
  if (!existsSync(AGENTS_DIR) && !existsSync(CONFIG_PATH)) {
    api.logger.warn(`${TAG} no agent configs found (checked ${AGENTS_DIR} and ${CONFIG_PATH}), bridge disabled`);
    return;
  }

  pluginApi = api;

  api.on("before_prompt_build", (event: unknown, hookCtx: unknown) => {
    const activePeer = loadActiveChorusPeerByAgentId(
      (hookCtx as { readonly agentId?: string } | undefined)?.agentId,
    );
    const injection = buildChorusRouterInjection(event as {
      readonly prompt?: string;
      readonly messages?: readonly unknown[];
    }, hookCtx as {
      readonly agentId?: string;
      readonly sessionKey?: string;
    }, activePeer);
    if (!injection) return;
    api.logger.info(`${TAG} before_prompt_build injected Chorus router context (agent=${(hookCtx as { readonly agentId?: string } | undefined)?.agentId ?? "?"}, activePeer=${activePeer?.peerId ?? "none"})`);
    return injection;
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
