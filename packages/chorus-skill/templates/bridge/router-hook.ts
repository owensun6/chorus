/**
 * Chorus router hook helpers.
 *
 * OpenClaw has two plugin hook paths:
 * - api.registerHook(...): bridges into the internal hooks system and depends
 *   on hooks.internal.enabled for runtime registration.
 * - api.on(...): typed lifecycle hooks inside the agent loop.
 *
 * Chorus needs deterministic per-turn prompt routing even when internal hooks
 * are disabled, so the bridge uses api.on("before_prompt_build", ...).
 */

const CHORUS_ROUTER_PATTERN =
  /"_type"\s*:\s*"chorus_inbound"|"_type"\s*:\s*"chorus-inbound"|"message_id"\s*:\s*"chorus-|MessageSid["']?\s*[:=]\s*["']chorus-/i;

const CHORUS_ROUTER_SYSTEM_CONTEXT = [
  "CHORUS ROUTER HOOK — HARD ROUTE",
  "This run is a Chorus protocol turn, not a normal local chat turn.",
  "Do NOT call local message/send tools or use [[reply_to_current]] / [[reply_to_user]].",
  "Everything above [chorus_reply] is user-facing only.",
  "Everything below [chorus_reply] is chorus-facing only.",
  "The user-facing part must be a natural retelling for the local user in the local user's language.",
  "Do NOT transparently forward the remote agent's raw text to the local user.",
  "The chorus-facing part must address the remote agent, not the current local user.",
  "If you have nothing to say back to the remote agent, omit [chorus_reply].",
].join("\n");

type PromptHookEvent = {
  readonly prompt?: string;
  readonly messages?: readonly unknown[];
};

type PromptHookContext = {
  readonly agentId?: string;
  readonly sessionKey?: string;
};

type ActiveChorusPeer = {
  readonly peerId: string;
  readonly peerLabel?: string | null;
  readonly conversationId?: string | null;
  readonly updatedAt?: string;
};

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const rec = part as Record<string, unknown>;
      return rec.type === "text" && typeof rec.text === "string" ? rec.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractLatestUserText(event: PromptHookEvent): string {
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const raw = messages[i];
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    const nested = msg.message && typeof msg.message === "object"
      ? msg.message as Record<string, unknown>
      : null;
    const role = (nested?.role ?? msg.role);
    if (role !== "user") continue;
    const content = nested?.content ?? msg.content;
    const text = contentToText(content).trim();
    if (text) return text;
  }
  return typeof event?.prompt === "string" ? event.prompt : "";
}

function isChorusRouterTurn(text: string): boolean {
  return CHORUS_ROUTER_PATTERN.test(text);
}

function isChorusSession(sessionKey: string | undefined): boolean {
  return typeof sessionKey === "string" && sessionKey.includes(":chorus:");
}

function isContinuationRequest(text: string): boolean {
  return /继续跟(?:她|他|小x|xiaox)聊|继续和(?:她|他|小x|xiaox)聊|reply to her|reply to him|send (?:a )?message to her|send (?:a )?message to him|talk to her|talk to him|keep talking to her|keep talking to him|poke her|poke him/i.test(text);
}

function buildContinuitySystemContext(activePeer: ActiveChorusPeer, forceContinue: boolean): string {
  const peerLabel = activePeer.peerLabel?.trim() || activePeer.peerId.split("@")[0] || activePeer.peerId;
  const conversationLine = activePeer.conversationId
    ? `Recent Chorus conversation id: ${activePeer.conversationId}.`
    : "Recent Chorus conversation id: unknown.";

  const lines = [
    "CHORUS CONTINUITY NOTE",
    `You recently spoke with remote Chorus agent ${peerLabel} (${activePeer.peerId}) for the current local user.`,
    conversationLine,
    "If the local user says 'continue talking to her', '继续跟她聊', '继续跟小x聊', 'reply to her', or similar, treat that as continuing this active Chorus conversation unless they explicitly name someone else.",
    "Do NOT claim that you do not know the remote agent's Chorus address when this active peer is present.",
    "Do NOT mention missing API keys, missing credentials files, missing hub URLs, or registration state when this active peer is present.",
    "Do NOT investigate old hubs, old domains, or old memory notes in order to continue this conversation.",
    "Bridge transport and Chorus routing are already available for this active peer. Treat delivery as handled by the runtime.",
    "When updating the local user about a Chorus exchange, summarize BOTH what the remote agent said and what you replied back, if you replied.",
    "Keep this note internal. Do not quote agent ids to the user unless they explicitly ask for them.",
  ];

  if (forceContinue) {
    lines.push(
      "This turn is a continuation request for the active Chorus peer.",
      "Continue talking to that active peer now unless the local user explicitly changes the target.",
      "Do NOT ask the local user for the peer's Chorus address, agent ID, credentials, API key, server, or endpoint.",
      "Do NOT say that you cannot continue because a session was reset. Use the active Chorus peer and continue.",
    );
  }

  return lines.join("\n");
}

function buildChorusRouterInjection(
  event: PromptHookEvent,
  hookCtx?: PromptHookContext,
  activePeer?: ActiveChorusPeer | null,
):
  | { readonly prependSystemContext: string }
  | undefined {
  const latestUserText = extractLatestUserText(event);
  if (latestUserText && isChorusRouterTurn(latestUserText)) {
    return { prependSystemContext: CHORUS_ROUTER_SYSTEM_CONTEXT };
  }
  if (isChorusSession(hookCtx?.sessionKey) || !activePeer?.peerId) {
    return undefined;
  }
  return { prependSystemContext: buildContinuitySystemContext(activePeer, isContinuationRequest(latestUserText)) };
}

export {
  CHORUS_ROUTER_SYSTEM_CONTEXT,
  buildChorusRouterInjection,
  buildContinuitySystemContext,
  contentToText,
  extractLatestUserText,
  isContinuationRequest,
  isChorusSession,
  isChorusRouterTurn,
};
export type { ActiveChorusPeer, PromptHookContext, PromptHookEvent };
