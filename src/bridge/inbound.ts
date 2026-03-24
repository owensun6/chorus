// Author: be-domain-modeler
import { ChorusEnvelopeSchema } from '../shared/types';
import { computeRouteKey } from './route-key';
import { DurableStateManager } from './state';
import type {
  BridgeDurableState,
  InboundFact,
  ContinuityEntry,
  HostAdapter,
  DeliveryReceipt,
  ISO8601,
} from './types';
import type { HubSSEEvent } from './hub-client';

interface DeliveryOutcome {
  readonly receipt: DeliveryReceipt;
  readonly continuity: ContinuityEntry;
  readonly turnNumber: number;
}

/**
 * Per-route processing lock to prevent concurrent processing of same route.
 */
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

const DEFAULT_DELIVER_TIMEOUT_MS = 30_000;

export interface InboundPipelineConfig {
  readonly localAgentId: string;
  readonly localCulture: string;
  readonly deliverTimeoutMs?: number;
}

/**
 * Inbound pipeline: observe → dedupe → adapt+deliver → cursor advance.
 *
 * Does NOT implement SSE consumption (T-06) or outbound relay (T-05).
 */
export class InboundPipeline {
  private readonly stateManager: DurableStateManager;
  private readonly hostAdapter: HostAdapter;
  private readonly config: InboundPipelineConfig;
  private readonly routeLock = new RouteLock();
  private readonly onError: (msg: string) => void;

  constructor(
    stateManager: DurableStateManager,
    hostAdapter: HostAdapter,
    config: InboundPipelineConfig,
    onError: (msg: string) => void = () => {},
  ) {
    this.stateManager = stateManager;
    this.hostAdapter = hostAdapter;
    this.config = config;
    this.onError = onError;
  }

  /**
   * Process a single inbound SSE event through the full pipeline.
   * Per-route lock ensures sequential processing for same route.
   */
  async processMessage(event: HubSSEEvent): Promise<void> {
    const validation = ChorusEnvelopeSchema.safeParse(event.envelope);
    if (!validation.success) {
      this.onError(`Envelope validation failed for trace_id=${event.trace_id}: ${validation.error.message}`);
      return;
    }

    const routeKey = computeRouteKey(this.config.localAgentId, event.sender_id);
    const release = await this.routeLock.acquire(routeKey);

    try {
      await this.processPipelineSteps(event, routeKey);
    } finally {
      release();
    }
  }

  private async processPipelineSteps(event: HubSSEEvent, routeKey: string): Promise<void> {
    // Phase 1: observe + dedupe (synchronous, inside mutate lock)
    const dedupeResult = await this.stateManager.mutate((state) => {
      const observedState = this.observe(state, event, routeKey);
      const result = this.dedupe(observedState, event.trace_id);
      // Tag the returned state so caller knows if duplicate
      return result.isDuplicate
        ? { ...result.state, _dedupe_duplicate: true as const }
        : result.state;
    }) as BridgeDurableState & { _dedupe_duplicate?: true };

    if (dedupeResult._dedupe_duplicate) return;

    // Phase 2: adapt + deliver (async I/O, then persist inside mutate lock)
    // We pass the dedupeResult snapshot to adaptAndDeliver for continuity/fact reads,
    // but the final save re-reads latest state inside mutate() to merge concurrent writes.
    const deliveryOutcome = await this.adaptAndDeliverOutcome(dedupeResult, event, routeKey);

    if (deliveryOutcome) {
      await this.stateManager.mutate((freshState) =>
        this.applyDeliveryOutcome(freshState, event.trace_id, deliveryOutcome, routeKey, event.hub_timestamp),
      );
    }
  }

  /**
   * Step 1: bridge_observed — create inbound_fact with initial fields.
   * If fact already exists (from prior run), preserve it for dedupe.
   */
  private observe(
    state: BridgeDurableState,
    event: HubSSEEvent,
    routeKey: string,
  ): BridgeDurableState {
    const existing = this.stateManager.getInboundFact(state, event.trace_id);
    if (existing) {
      return state;
    }
    const now = new Date().toISOString();
    const fact: InboundFact = {
      route_key: routeKey,
      observed_at: now,
      hub_timestamp: event.hub_timestamp,
      dedupe_result: null,
      delivery_evidence: null,
      terminal_disposition: null,
      cursor_advanced: false,
    };
    return this.stateManager.setInboundFact(state, event.trace_id, fact);
  }

  /**
   * Step 2: dedupe_decided — check trace_id against existing facts.
   */
  private dedupe(
    state: BridgeDurableState,
    traceId: string,
  ): { isDuplicate: boolean; state: BridgeDurableState } {
    const existingFact = state.inbound_facts[traceId];
    if (!existingFact) {
      return { isDuplicate: false, state };
    }

    // Check if already fully processed (cursor_advanced=true from a prior run)
    if (existingFact.cursor_advanced) {
      const updatedFact: InboundFact = {
        ...existingFact,
        dedupe_result: 'duplicate',
        terminal_disposition: existingFact.terminal_disposition ?? {
          reason: 'duplicate',
          decided_at: new Date().toISOString(),
        },
      };
      const withFact = this.stateManager.setInboundFact(state, traceId, updatedFact);
      return { isDuplicate: true, state: withFact };
    }

    // New fact just created in observe step — mark as "new" and continue
    const newFact: InboundFact = { ...existingFact, dedupe_result: 'new' };
    const withFact = this.stateManager.setInboundFact(state, traceId, newFact);
    return { isDuplicate: false, state: withFact };
  }

  /**
   * Perform async I/O (adapt + deliver) and return the outcome data.
   * No state mutation here — outcome is applied inside mutate() by the caller.
   * Returns null on transient failure (fact stays retryable).
   */
  private async adaptAndDeliverOutcome(
    stateSnapshot: BridgeDurableState,
    event: HubSSEEvent,
    routeKey: string,
  ): Promise<DeliveryOutcome | null> {
    const rawContinuity = this.ensureContinuity(stateSnapshot, routeKey, event);

    const continuity = rawContinuity.local_anchor_id
      ? rawContinuity
      : { ...rawContinuity, local_anchor_id: await this.hostAdapter.resolveLocalAnchor(routeKey) };

    const adaptedContent = await this.hostAdapter.adaptContent({
      original_text: event.envelope.original_text,
      sender_culture: event.envelope.sender_culture,
      receiver_culture: this.config.localCulture,
      cultural_context: event.envelope.cultural_context ?? null,
    });

    const turnNumber = continuity.last_inbound_turn + 1;

    const timeoutMs = this.config.deliverTimeoutMs ?? DEFAULT_DELIVER_TIMEOUT_MS;
    const TIMEOUT_SENTINEL = Symbol('delivery_timeout');

    try {
      const deliveryPromise = this.hostAdapter.deliverInbound({
        route_key: routeKey,
        local_anchor_id: continuity.local_anchor_id,
        adapted_content: adaptedContent,
        metadata: {
          sender_id: event.sender_id,
          sender_culture: event.envelope.sender_culture,
          cultural_context: event.envelope.cultural_context ?? null,
          conversation_id: continuity.conversation_id,
          turn_number: turnNumber,
          trace_id: event.trace_id,
        },
      });
      const holder: { timer: ReturnType<typeof setTimeout> | null } = { timer: null };
      const result = await Promise.race([
        deliveryPromise,
        new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
          holder.timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs);
        }),
      ]);
      if (holder.timer !== null) clearTimeout(holder.timer);

      if (result === TIMEOUT_SENTINEL) {
        // Timeout: underlying send may have completed — outcome unknown.
        // Cannot retry (would risk duplicate delivery). Mark as unverifiable.
        this.onError(`Delivery timeout for trace_id=${event.trace_id}: send may have completed, marking unverifiable`);
        const timeoutReceipt: DeliveryReceipt = {
          status: 'unverifiable',
          method: 'timeout',
          ref: null,
          timestamp: new Date().toISOString(),
        };
        return { receipt: timeoutReceipt, continuity, turnNumber };
      }

      return { receipt: result, continuity, turnNumber };
    } catch (err) {
      // Host threw before or during delivery — true transient failure, safe to retry
      this.onError(`Transient delivery failure for trace_id=${event.trace_id}: ${String(err)}`);
      await this.stateManager.mutate((s) =>
        this.stateManager.setContinuity(s, routeKey, continuity),
      );
      return null;
    }
  }

  /**
   * Apply delivery outcome to fresh state inside mutate() lock.
   * Reads fact from fresh state, applies receipt result, advances cursor.
   */
  private applyDeliveryOutcome(
    state: BridgeDurableState,
    traceId: string,
    outcome: DeliveryOutcome,
    routeKey: string,
    hubTimestamp: ISO8601,
  ): BridgeDurableState {
    const fact = state.inbound_facts[traceId];
    if (!fact) return state;

    const { receipt, continuity, turnNumber } = outcome;
    const now = new Date().toISOString();

    // Always persist continuity (including resolved local_anchor_id)
    const stateWithContinuity = this.stateManager.setContinuity(state, routeKey, continuity);

    if (receipt.status === 'confirmed') {
      const updatedFact: InboundFact = {
        ...fact,
        delivery_evidence: {
          delivered_at: receipt.timestamp,
          method: receipt.method,
          ref: receipt.ref,
        },
        cursor_advanced: true,
      };
      const updatedContinuity: ContinuityEntry = {
        ...continuity,
        last_inbound_turn: turnNumber,
        updated_at: now,
      };
      const s1 = this.stateManager.setInboundFact(stateWithContinuity, traceId, updatedFact);
      const s2 = this.stateManager.setContinuity(s1, routeKey, updatedContinuity);
      return this.stateManager.advanceCursor(s2, traceId, hubTimestamp);
    }

    if (receipt.status === 'failed') {
      const updatedFact: InboundFact = {
        ...fact,
        terminal_disposition: { reason: 'delivery_failed_permanent', decided_at: now },
        cursor_advanced: true,
      };
      const s1 = this.stateManager.setInboundFact(stateWithContinuity, traceId, updatedFact);
      return this.stateManager.advanceCursor(s1, traceId, hubTimestamp);
    }

    // status === 'unverifiable'
    const updatedFact: InboundFact = {
      ...fact,
      terminal_disposition: { reason: 'delivery_unverifiable', decided_at: now },
      cursor_advanced: true,
    };
    const s1 = this.stateManager.setInboundFact(stateWithContinuity, traceId, updatedFact);
    return this.stateManager.advanceCursor(s1, traceId, hubTimestamp);
  }

  private ensureContinuity(
    state: BridgeDurableState,
    routeKey: string,
    event: HubSSEEvent,
  ): ContinuityEntry {
    const existing = this.stateManager.getContinuity(state, routeKey);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    return {
      remote_peer_id: event.sender_id,
      local_anchor_id: '',
      conversation_id: event.envelope.conversation_id ?? null,
      last_inbound_turn: 0,
      last_outbound_turn: 0,
      created_at: now,
      updated_at: now,
    };
  }
}
