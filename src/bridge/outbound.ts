// Author: be-domain-modeler
import { randomUUID } from 'crypto';
import { DurableStateManager } from './state';
import type {
  BridgeDurableState,
  RelayRecord,
  ContinuityEntry,
  ISO8601,
} from './types';
import type { ChorusEnvelope } from '../shared/types';
import type { HubClient, RelayResult } from './hub-client';

export interface OutboundConfig {
  readonly localAgentId: string;
  readonly localCulture: string;
}

class RouteLock {
  private readonly locks = new Map<string, Promise<void>>();

  async acquire(routeKey: string): Promise<() => void> {
    const current = this.locks.get(routeKey) ?? Promise.resolve();
    const { promise, resolve } = this.createDeferred();
    this.locks.set(routeKey, promise);
    await current;
    return () => {
      resolve();
      if (this.locks.get(routeKey) === promise) {
        this.locks.delete(routeKey);
      }
    };
  }

  private createDeferred(): { promise: Promise<void>; resolve: () => void } {
    const holder: { resolve: () => void } = { resolve: () => {} };
    const promise = new Promise<void>((r) => { holder.resolve = r; });
    return { promise, resolve: holder.resolve };
  }
}

/**
 * Outbound pipeline: reply binding → relay submission → confirmation.
 *
 * Does NOT implement Hub HTTP client (T-06) or inbound pipeline (T-04).
 */
export class OutboundPipeline {
  private readonly stateManager: DurableStateManager;
  private readonly config: OutboundConfig;
  private readonly routeLock = new RouteLock();

  constructor(
    stateManager: DurableStateManager,
    config: OutboundConfig,
  ) {
    this.stateManager = stateManager;
    this.config = config;
  }

  /**
   * Route-scoped happy path: bind reply, submit relay, confirm relay.
   * Prevents duplicate bound_turn_number allocation when same-route replies overlap.
   */
  async relayReply(
    routeKey: string,
    replyText: string,
    inboundTraceId: string | null,
    hubClient: HubClient,
    apiKey: string,
  ): Promise<RelayResult> {
    const release = await this.routeLock.acquire(routeKey);
    try {
      const outboundId = this.bindReply(routeKey, replyText, inboundTraceId);
      const result = await this.submitRelay(outboundId, hubClient, apiKey);
      await this.confirmRelay(outboundId, result.trace_id);
      return result;
    } finally {
      release();
    }
  }

  /**
   * Step 1: reply_bound — bind reply to relay_evidence BEFORE any submission.
   * Returns the outbound_id for subsequent submitRelay/confirmRelay calls.
   */
  bindReply(
    routeKey: string,
    replyText: string,
    inboundTraceId: string | null,
  ): string {
    if (!replyText || replyText.trim().length === 0) {
      throw new Error('reply_text must be non-empty');
    }

    const state = this.stateManager.load();
    const continuity = this.stateManager.getContinuity(state, routeKey);
    if (!continuity) {
      throw new Error(`No continuity entry for route_key="${routeKey}"`);
    }

    const outboundId = randomUUID();
    const idempotencyKey = `relay:${this.config.localAgentId}:${outboundId}`;
    const boundTurnNumber = continuity.last_outbound_turn + 1;

    const record: RelayRecord = {
      inbound_trace_id: inboundTraceId,
      route_key: routeKey,
      reply_text: replyText,
      bound_turn_number: boundTurnNumber,
      idempotency_key: idempotencyKey,
      submitted_at: null,
      hub_trace_id: null,
      confirmed: false,
    };

    const updated = this.stateManager.setRelayEvidence(state, outboundId, record);
    this.stateManager.save(updated);

    return outboundId;
  }

  /**
   * Step 2: relay_submitted — reconstruct envelope and submit via HubClient.
   * Records submitted_at and hub_trace_id on success.
   */
  async submitRelay(
    outboundId: string,
    hubClient: HubClient,
    apiKey: string,
  ): Promise<RelayResult> {
    const state = this.stateManager.load();
    const record = this.stateManager.getRelayEvidence(state, outboundId);
    if (!record) {
      throw new Error(`No relay_evidence for outbound_id="${outboundId}"`);
    }

    const continuity = this.stateManager.getContinuity(state, record.route_key);
    if (!continuity) {
      throw new Error(`No continuity for route_key="${record.route_key}"`);
    }

    const envelope = this.buildEnvelope(record, continuity);
    const result = await hubClient.submitRelay(
      apiKey,
      continuity.remote_peer_id,
      envelope,
      record.idempotency_key,
    );

    // Record submission result inside write lock to prevent cross-route overwrites
    const now = new Date().toISOString();
    const updatedRecord: RelayRecord = {
      ...record,
      submitted_at: now,
      hub_trace_id: result.trace_id,
    };
    await this.stateManager.mutate((freshState) =>
      this.stateManager.setRelayEvidence(freshState, outboundId, updatedRecord),
    );

    return result;
  }

  /**
   * Step 3: relay_confirmed — mark confirmed, update continuity turn number.
   */
  async confirmRelay(outboundId: string, hubTraceId: string): Promise<void> {
    await this.stateManager.mutate((state) => {
      const record = this.stateManager.getRelayEvidence(state, outboundId);
      if (!record) {
        throw new Error(`No relay_evidence for outbound_id="${outboundId}"`);
      }

      const continuity = this.stateManager.getContinuity(state, record.route_key);
      if (!continuity) {
        throw new Error(`No continuity for route_key="${record.route_key}"`);
      }

      const updatedRecord: RelayRecord = {
        ...record,
        hub_trace_id: hubTraceId,
        confirmed: true,
      };

      const now = new Date().toISOString();
      const updatedContinuity: ContinuityEntry = {
        ...continuity,
        last_outbound_turn: record.bound_turn_number,
        updated_at: now,
      };

      const s1 = this.stateManager.setRelayEvidence(state, outboundId, updatedRecord);
      return this.stateManager.setContinuity(s1, record.route_key, updatedContinuity);
    });
  }

  /**
   * Build outbound ChorusEnvelope from relay_evidence + continuity + config.
   * conversation_id is omitted when null (not fabricated).
   */
  private buildEnvelope(
    record: RelayRecord,
    continuity: ContinuityEntry,
  ): ChorusEnvelope {
    const base: Record<string, unknown> = {
      chorus_version: '0.4' as const,
      sender_id: this.config.localAgentId,
      original_text: record.reply_text,
      sender_culture: this.config.localCulture,
      turn_number: record.bound_turn_number,
    };

    if (continuity.conversation_id !== null) {
      base.conversation_id = continuity.conversation_id;
    }

    return base as ChorusEnvelope;
  }
}
