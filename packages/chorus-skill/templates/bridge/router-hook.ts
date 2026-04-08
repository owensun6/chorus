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
  "",
  "LANGUAGE CONTRACT (ABSOLUTE, NOT OPTIONAL):",
  "The user-facing part MUST be in YOUR local user's language — not the sender's language, not English by default.",
  "If the inbound envelope carries `receiver_preferred_language` or `adaptation_instruction`, that is YOUR user's language. Follow it verbatim.",
  "If no such hint is present, infer your user's language from your own chorus-credentials.json (user_culture) or from recent local conversation — never default to English.",
  "If your user's language is Chinese and you output English to them, or vice versa, this is a contract violation, not a stylistic choice. The run is considered failed.",
  "Do NOT quote, forward, paraphrase-in-source-language, or 'include for reference' the remote agent's untranslated original_text inside the user-facing part. Rewrite it entirely in your user's language.",
  "",
  "The user-facing part must be a natural retelling for the local user in the local user's language, speaking to the local user in third person about the remote agent.",
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
  readonly routeKey?: string;
  readonly lastInboundSummary?: string | null;
  readonly lastOutboundReply?: string | null;
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

function trimWrappedQuotes(text: string): string {
  return text
    .replace(/^[\s"'`“”‘’]+/, "")
    .replace(/[\s"'`“”‘’]+$/, "")
    .trim();
}

function stripContinuationDirectives(text: string): string {
  let next = text.trim();
  const directivePatterns = [
    /\s*(?:只回复[她他]|只回[她他]|只对[她他]说|只发给[她他])[\s，,。.!！?？]*$/i,
    /\s*(?:不要解释|不要说明|别解释|别说明|不要补充|别补充)[\s，,。.!！?？]*$/i,
    /\s*(?:just reply to (?:her|him)|reply only to (?:her|him)|and nothing else|without explanation|don't explain|do not explain)[\s,.;:!?]*$/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of directivePatterns) {
      const updated = next.replace(pattern, "").trim();
      if (updated !== next) {
        next = updated;
        changed = true;
      }
    }
  }
  return trimWrappedQuotes(next);
}

function cutContinuationAtDirectiveBoundary(text: string): string {
  const directiveStarts = [
    /只回复[她他]/i,
    /只回[她他]/i,
    /只对[她他]说/i,
    /只发给[她他]/i,
    /不要解释/i,
    /不要说明/i,
    /别解释/i,
    /别说明/i,
    /不要补充/i,
    /别补充/i,
    /不要调用(?:任何)?工具/i,
    /不要用工具/i,
    /不要手工发送/i,
    /不要确认已发送/i,
    /不要确认发送/i,
    /不要确认/i,
    /不要说(?:发过去了|sent|done)/i,
    /你的最终回复必须/i,
    /最终回复必须/i,
    /just reply to (?:her|him)/i,
    /reply only to (?:her|him)/i,
    /without explanation/i,
    /don'?t explain/i,
    /do not explain/i,
    /don'?t call (?:any )?tools?/i,
    /do not call (?:any )?tools?/i,
    /don'?t manually send/i,
    /do not manually send/i,
    /don'?t confirm sent/i,
    /do not confirm sent/i,
    /your final assistant text must/i,
    /your final reply must/i,
  ];

  let boundary = text.length;
  for (const pattern of directiveStarts) {
    const match = pattern.exec(text);
    if (match && typeof match.index === "number" && match.index < boundary) {
      boundary = match.index;
    }
  }

  const sliced = boundary < text.length ? text.slice(0, boundary) : text;
  return sliced.replace(/[\s，,；;:：]+$/, "").trim();
}

function extractContinuationReplyBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns = [
    /(?:告诉她|跟她说|对她说|回复她)\s*[：:,，]?\s*([\s\S]+)$/i,
    /(?:告诉他|跟他说|对他说|回复他)\s*[：:,，]?\s*([\s\S]+)$/i,
    /(?:tell|reply to)\s+(?:her|him)\s*[:,:]?\s*([\s\S]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) continue;
    const body = stripContinuationDirectives(cutContinuationAtDirectiveBoundary(match[1]));
    if (body) return body;
  }

  return null;
}

function buildContinuitySystemContext(activePeer: ActiveChorusPeer, forceContinue: boolean): string {
  const peerLabel = activePeer.peerLabel?.trim() || activePeer.peerId.split("@")[0] || activePeer.peerId;
  const conversationLine = activePeer.conversationId
    ? `Recent Chorus conversation id: ${activePeer.conversationId}.`
    : "Recent Chorus conversation id: unknown.";
  const routeLine = activePeer.routeKey
    ? `Active Chorus route_key: ${activePeer.routeKey}.`
    : null;
  const lastInboundLine = activePeer.lastInboundSummary?.trim()
    ? `Most recent remote message summary: ${activePeer.lastInboundSummary}`
    : "Most recent remote message summary: unavailable from durable state.";
  const lastOutboundLine = activePeer.lastOutboundReply?.trim()
    ? `Most recent reply you sent back: ${activePeer.lastOutboundReply}`
    : "Most recent reply you sent back: none recorded yet.";

  const lines = [
    "CHORUS CONTINUITY NOTE",
    "The following Chorus continuity facts come from durable bridge state and are authoritative for this turn.",
    `You recently spoke with remote Chorus agent ${peerLabel} (${activePeer.peerId}) for the current local user.`,
    conversationLine,
    routeLine,
    lastInboundLine,
    lastOutboundLine,
    "If the local user asks '她刚才说了什么', 'what did she just say', or an equivalent question about the latest remote message, answer directly from 'Most recent remote message summary' above.",
    "If the local user asks '你刚回复了什么', 'what did you reply', or an equivalent question about your latest Chorus reply, answer directly from 'Most recent reply you sent back' above.",
    "If the local user says 'continue talking to her', '继续跟她聊', '继续跟小x聊', 'reply to her', or similar, treat that as continuing this active Chorus conversation unless they explicitly name someone else.",
    "For those three cases, do NOT say you cannot see the message record, cannot access history, do not know, or need the user to repeat the Chorus content. Use the durable-state facts above.",
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
      "Write the remote-facing message directly as your final assistant text for this turn.",
      "Your final assistant text must be the exact remote-facing body requested by the local user, with no extra local confirmation before or after it.",
      "Do NOT call skills, tools, read files, inspect configs, or look up credentials in order to continue.",
      "Any tool call, skill invocation, manual curl, or direct Hub/API send in this turn is invalid.",
      "Do NOT try to manually send Chorus envelopes yourself.",
      "The bridge runtime will bind the active route_key and relay your final assistant text automatically.",
      "Do NOT end with local confirmation text such as '发过去了', 'sent', 'done', or similar. The runtime handles sending.",
      "Because the local user asked to continue talking to her, do NOT add local-user explanation around the message unless they explicitly asked for it.",
      "Do NOT ask the local user for the peer's Chorus address, agent ID, credentials, API key, server, or endpoint.",
      "Do NOT say that you cannot continue because a session was reset. Use the active Chorus peer and continue.",
    );
  }

  return lines.filter((line): line is string => Boolean(line)).join("\n");
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
  extractContinuationReplyBody,
  extractLatestUserText,
  isContinuationRequest,
  isChorusSession,
  isChorusRouterTurn,
};
export type { ActiveChorusPeer, PromptHookContext, PromptHookEvent };
