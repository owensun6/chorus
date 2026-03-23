/**
 * Pure functions for delivery target and culture resolution.
 * Importable by both index.ts and tests — no side effects, no I/O.
 */

export type DeliveryTarget = {
  readonly channel: string;
  readonly to: string;
  readonly accountId: string;
};

export type ReceiverPrefs = {
  readonly culture: string;
  readonly preferredLanguage: string;
};

/**
 * Extract delivery target from a sessions data object.
 * Channel comes from deliveryContext — no hardcoded default.
 */
export function resolveDeliveryTargetFromSessions(
  sessions: Record<string, any> | null,
  agentName: string,
): DeliveryTarget | null {
  if (!sessions) return null;
  const mainSession = sessions[`agent:${agentName}:main`];
  if (!mainSession?.deliveryContext) return null;
  const { channel, to, accountId } = mainSession.deliveryContext;
  if (!channel || !to) return null;
  return { channel, to, accountId };
}

/**
 * Derive receiver culture prefs from agent config.
 * Returns null if the config has no culture — caller decides how to handle.
 */
export function resolveReceiverPrefs(config: {
  readonly culture?: string;
  readonly preferred_language?: string;
}): ReceiverPrefs | null {
  const culture = config.culture;
  if (!culture) return null;
  const lang = config.preferred_language ?? culture;
  return { culture, preferredLanguage: lang };
}

/** Extract primary language subtag from BCP47 tag (e.g. "zh-CN" → "zh") */
export function primarySubtag(bcp47: string): string {
  return bcp47.split("-")[0].toLowerCase();
}

// === Reply content separation ===

export type ReplyParts = {
  readonly userText: string;
  readonly relayText: string | null; // null = agent chose not to reply to remote
};

/**
 * Strip `<final>` / `</final>` wrapper tags if present.
 * OpenClaw's dispatch normally strips these before calling deliver,
 * but if they leak through, we handle them gracefully.
 */
function stripFinalTags(text: string): string {
  return text.replace(/^<final>\s*/i, "").replace(/\s*<\/final>\s*$/i, "");
}

/**
 * Split the agent's raw reply into user-facing and chorus-facing parts.
 *
 * The agent's output arrives from OpenClaw's `<final>` dispatch — only
 * content INSIDE `<final>...</final>` reaches this function. The marker
 * [chorus_reply] must therefore be inside the final answer.
 *
 * No [chorus_reply] marker → user gets full text, no relay (agent opted out).
 * [chorus_reply] present → user gets text before marker, relay gets text after.
 */
export function splitReplyParts(rawText: string): ReplyParts {
  const cleaned = stripFinalTags(rawText);
  const marker = "[chorus_reply]";
  const idx = cleaned.indexOf(marker);
  if (idx === -1) {
    return { userText: cleaned, relayText: null };
  }
  const userText = cleaned.slice(0, idx).trim();
  const relayText = cleaned.slice(idx + marker.length).trim();
  return {
    userText: userText || cleaned,
    relayText: relayText || null,
  };
}

/**
 * Detect when userText looks like a raw relay dump rather than a
 * natural user-facing update. Returns a diagnostic string or null.
 *
 * Heuristics (any one triggers):
 * - userText and relayText are identical
 * - userText starts with a Chorus address pattern (agent@host)
 * - userText is empty / whitespace-only
 */
export function diagnoseUserText(
  userText: string,
  relayText: string | null,
): string | null {
  const trimmed = userText.trim();
  if (!trimmed) return "empty_user_text";
  if (relayText && trimmed === relayText.trim()) return "user_equals_relay";
  if (/^[a-zA-Z0-9_-]+@[a-zA-Z0-9._-]+/.test(trimmed)) return "starts_with_agent_address";
  return null;
}

// === Outbound envelope construction ===

export type OutboundEnvelope = {
  readonly chorus_version: "0.4";
  readonly sender_id: string;
  readonly original_text: string;
  readonly sender_culture: string;
  readonly conversation_id?: string;
  readonly turn_number?: number;
};

/**
 * Build a Chorus envelope for an outbound relay (agent reply → Hub).
 * The receiver_id is NOT in the envelope (it's in the transport request).
 * turn_number increments from the inbound turn.
 */
export function buildOutboundEnvelope(
  agentId: string,
  agentCulture: string,
  replyText: string,
  inboundConversationId: string | null,
  inboundTurnNumber: number | null,
): OutboundEnvelope {
  const envelope: Record<string, unknown> = {
    chorus_version: "0.4",
    sender_id: agentId,
    original_text: replyText,
    sender_culture: agentCulture,
  };
  if (inboundConversationId) {
    envelope.conversation_id = inboundConversationId;
  }
  if (inboundTurnNumber != null) {
    envelope.turn_number = inboundTurnNumber + 1;
  }
  return envelope as OutboundEnvelope;
}

/**
 * Derive the outbound receiver_id from an inbound envelope's sender_id.
 */
export function deriveOutboundReceiver(
  inboundEnvelope: Record<string, unknown>,
): string | null {
  const senderId = inboundEnvelope.sender_id;
  return typeof senderId === "string" && senderId ? senderId : null;
}

/**
 * Check whether an outbound relay should proceed based on turn count.
 * Returns false if the conversation has exceeded the turn limit.
 */
export function shouldRelay(
  inboundTurnNumber: number | null,
  maxTurns: number,
): boolean {
  if (inboundTurnNumber == null) return true; // no turn tracking → allow
  return inboundTurnNumber < maxTurns;
}

// === Session isolation ===

/**
 * Derive a Chorus-specific session key that is ISOLATED from the user
 * main session.
 *
 * WHY: Chorus inbound injects reply_format (with [chorus_reply] marker)
 * into the session context. If this lands in the user main session,
 * ALL subsequent normal user messages inherit the marker — and normal
 * channel delivery doesn't strip it, leaking raw protocol to the user.
 *
 * The session key includes sender_id (per-peer isolation) and optionally
 * conversation_id (per-conversation isolation when available).
 */
export function deriveChorusSessionKey(
  agentName: string,
  senderId: string,
  conversationId?: string | null,
): string {
  const safeSender = senderId.replace(/[^a-zA-Z0-9@._-]/g, "_");
  const base = `agent:${agentName}:chorus:${safeSender}`;
  if (conversationId) {
    const safeConv = conversationId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${base}:${safeConv}`;
  }
  return base;
}
