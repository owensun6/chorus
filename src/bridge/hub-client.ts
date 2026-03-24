// Author: be-domain-modeler
import type { ChorusEnvelope } from '../shared/types';
import type { ISO8601 } from './types';

/**
 * Parsed SSE message event from Hub inbox.
 */
export interface HubSSEEvent {
  readonly trace_id: string;
  readonly sender_id: string;
  readonly envelope: ChorusEnvelope;
  readonly hub_timestamp: ISO8601;
}

/**
 * Stored message from Hub history endpoint.
 */
export interface HubHistoryMessage {
  readonly trace_id: string;
  readonly sender_id: string;
  readonly receiver_id: string;
  readonly envelope: ChorusEnvelope;
  readonly delivered_via: string;
  readonly timestamp: ISO8601;
}

/**
 * Relay submission result from Hub.
 */
export interface RelayResult {
  readonly trace_id: string;
  readonly delivery: string;
}

/**
 * Error thrown by HubClient for typed error handling.
 */
export class HubClientError extends Error {
  readonly statusCode: number | null;
  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = 'HubClientError';
    this.statusCode = statusCode;
  }
}

const REQUIRED_SSE_FIELDS = ['trace_id', 'sender_id', 'envelope', 'timestamp'] as const;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;

/**
 * Compute backoff delay with exponential growth and cap.
 */
export const computeBackoff = (attempt: number): number => {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
  return Math.min(delay, BACKOFF_CAP_MS);
};

/**
 * Parse a raw SSE data payload into a HubSSEEvent.
 * Returns null if any required field is missing (Hub contract violation).
 */
export const parseSSEEvent = (
  rawData: string,
  onError: (msg: string) => void,
): HubSSEEvent | null => {
  try {
    const parsed = JSON.parse(rawData) as Record<string, unknown>;

    for (const field of REQUIRED_SSE_FIELDS) {
      if (parsed[field] === undefined || parsed[field] === null) {
        onError(`Hub contract violation: SSE event missing required field "${field}"`);
        return null;
      }
    }

    return Object.freeze({
      trace_id: parsed.trace_id as string,
      sender_id: parsed.sender_id as string,
      envelope: parsed.envelope as ChorusEnvelope,
      hub_timestamp: parsed.timestamp as ISO8601,
    });
  } catch {
    onError(`Hub contract violation: SSE event is not valid JSON`);
    return null;
  }
};

/**
 * Parse Hub history response into typed messages.
 */
export const parseHistoryResponse = (
  data: readonly Record<string, unknown>[],
): readonly HubHistoryMessage[] =>
  Object.freeze(data.map((msg) => Object.freeze({
    trace_id: msg.trace_id as string,
    sender_id: msg.sender_id as string,
    receiver_id: msg.receiver_id as string,
    envelope: msg.envelope as ChorusEnvelope,
    delivered_via: msg.delivered_via as string,
    timestamp: msg.timestamp as ISO8601,
  })));

/**
 * Hub Client — manages SSE subscription, history fetch, and relay submission.
 *
 * Does NOT implement pipeline logic or recovery logic.
 * API key is passed per-call, never stored.
 */
export type SSECallback = (event: HubSSEEvent) => void;

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_RELAY_TIMEOUT_MS = 60_000;

/**
 * Fetch with AbortController timeout. Throws on timeout.
 */
const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new HubClientError(`Request timed out after ${timeoutMs}ms`, null);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export interface HubClientConfig {
  readonly fetchTimeoutMs?: number;
  readonly relayTimeoutMs?: number;
}

export class HubClient {
  private readonly hubUrl: string;
  private readonly fetchTimeoutMs: number;
  private readonly relayTimeoutMs: number;
  private sseAbort: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(hubUrl: string, config: HubClientConfig = {}) {
    this.hubUrl = hubUrl.replace(/\/+$/, '');
    this.fetchTimeoutMs = config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    this.relayTimeoutMs = config.relayTimeoutMs ?? DEFAULT_RELAY_TIMEOUT_MS;
  }

  /**
   * Connect to Hub SSE inbox. Parses events through parseSSEEvent,
   * discarding invalid ones. Reconnects with exponential backoff on disconnect.
   */
  connectSSE(
    agentId: string,
    apiKey: string,
    onEvent: SSECallback,
    onError: (msg: string) => void = () => {},
  ): void {
    this.disconnectInternal();
    this.startSSE(apiKey, onEvent, onError, 0);
  }

  /**
   * Clean SSE teardown — stops reconnection and aborts active stream.
   */
  disconnect(): void {
    this.disconnectInternal();
  }

  private disconnectInternal(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sseAbort) {
      this.sseAbort.abort();
      this.sseAbort = null;
    }
  }

  private startSSE(
    apiKey: string,
    onEvent: SSECallback,
    onError: (msg: string) => void,
    attempt: number,
  ): void {
    const controller = new AbortController();
    this.sseAbort = controller;

    const url = `${this.hubUrl}/agent/inbox?token=${encodeURIComponent(apiKey)}`;

    fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok || !res.body) {
          throw new HubClientError(`SSE connect failed: HTTP ${res.status}`, res.status);
        }
        return this.consumeStream(res.body, onEvent, onError);
      })
      .then(() => {
        // Stream ended normally — reconnect
        if (this.sseAbort === controller) {
          this.scheduleReconnect(apiKey, onEvent, onError, 0);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // intentional disconnect
        onError(`SSE connection error: ${String(err)}`);
        if (this.sseAbort === controller) {
          this.scheduleReconnect(apiKey, onEvent, onError, attempt + 1);
        }
      });
  }

  private scheduleReconnect(
    apiKey: string,
    onEvent: SSECallback,
    onError: (msg: string) => void,
    attempt: number,
  ): void {
    const delay = computeBackoff(attempt);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.startSSE(apiKey, onEvent, onError, attempt);
    }, delay);
  }

  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    onEvent: SSECallback,
    onError: (msg: string) => void,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const eventLine = block.split('\n').find((l) => l.startsWith('event: '));
          const eventType = eventLine?.slice(7) ?? '';
          if (eventType !== 'message') continue;

          const parsed = parseSSEEvent(dataLine.slice(6), onError);
          if (parsed) {
            onEvent(parsed);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Fetch message history from Hub with inclusive boundary.
   * Timeout: fail closed — caller (recovery) handles retry.
   */
  async fetchHistory(apiKey: string, sinceTimestamp?: ISO8601): Promise<readonly HubHistoryMessage[]> {
    const url = sinceTimestamp
      ? `${this.hubUrl}/agent/messages?since=${encodeURIComponent(sinceTimestamp)}`
      : `${this.hubUrl}/agent/messages`;

    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, this.fetchTimeoutMs);

    if (!res.ok) {
      throw new HubClientError(
        `History fetch failed: HTTP ${res.status}`,
        res.status,
      );
    }

    const body = await res.json() as { success: boolean; data: Record<string, unknown>[] };
    if (!body.success) {
      throw new HubClientError('History fetch returned success=false');
    }

    return parseHistoryResponse(body.data);
  }

  /**
   * Submit a relay message to Hub with Idempotency-Key header.
   * Timeout: retryable failure — caller should retry with same idempotency key.
   */
  async submitRelay(
    apiKey: string,
    receiverId: string,
    envelope: ChorusEnvelope,
    idempotencyKey: string,
  ): Promise<RelayResult> {
    const res = await fetchWithTimeout(`${this.hubUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ receiver_id: receiverId, envelope }),
    }, this.relayTimeoutMs);

    if (!res.ok) {
      throw new HubClientError(
        `Relay submission failed: HTTP ${res.status}`,
        res.status,
      );
    }

    const body = await res.json() as { success: boolean; data: { trace_id: string; delivery: string } };
    if (!body.success) {
      throw new HubClientError('Relay submission returned success=false');
    }

    return Object.freeze({
      trace_id: body.data.trace_id,
      delivery: body.data.delivery,
    });
  }
}
