/**
 * Outbound relay: POST agent reply back to Chorus Hub.
 * Extracted for testability — accepts fetchFn parameter.
 */

import {
  buildOutboundEnvelope,
  deriveOutboundReceiver,
  shouldRelay,
} from "./resolve.ts";
import type { OutboundEnvelope } from "./resolve.ts";

export type RelayConfig = {
  readonly agent_id: string;
  readonly api_key: string;
  readonly hub_url: string;
  readonly culture?: string;
};

export type RelayResult = {
  readonly ok: boolean;
  readonly trace_id: string | null;
  readonly receiver_id: string | null;
  readonly envelope: OutboundEnvelope | null;
  readonly reason?: string;
};

/**
 * POST the agent's reply to the Chorus Hub as an outbound envelope.
 * Returns a structured result — caller handles history and logging.
 *
 * @param fetchFn - injectable for testing. Defaults to globalThis.fetch.
 */
export async function relayToHub(
  config: RelayConfig,
  inboundEnvelope: Record<string, unknown>,
  replyText: string,
  maxTurns: number,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<RelayResult> {
  const receiverId = deriveOutboundReceiver(inboundEnvelope);
  if (!receiverId) {
    return { ok: false, trace_id: null, receiver_id: null, envelope: null, reason: "no_receiver" };
  }

  const inboundTurn = (inboundEnvelope.turn_number as number | null) ?? null;
  if (!shouldRelay(inboundTurn, maxTurns)) {
    return { ok: false, trace_id: null, receiver_id: receiverId, envelope: null, reason: "turn_limit" };
  }

  const outEnvelope = buildOutboundEnvelope(
    config.agent_id,
    config.culture ?? "en",
    replyText,
    (inboundEnvelope.conversation_id as string) ?? null,
    inboundTurn,
  );

  const res = await fetchFn(`${config.hub_url}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({ receiver_id: receiverId, envelope: outEnvelope }),
  });

  if (!res.ok) {
    return { ok: false, trace_id: null, receiver_id: receiverId, envelope: outEnvelope, reason: `http_${res.status}` };
  }

  const body = (await res.json()) as { data?: { trace_id?: string } };
  const traceId = body?.data?.trace_id ?? null;

  return { ok: true, trace_id: traceId, receiver_id: receiverId, envelope: outEnvelope };
}
