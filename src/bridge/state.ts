// Author: be-domain-modeler
import * as fs from 'fs';
import * as path from 'path';
import type {
  BridgeDurableState,
  InboundFact,
  ContinuityEntry,
  RelayRecord,
} from './types';

const SCHEMA_VERSION = '2.0' as const;

// Pruning caps — [未校准] defaults, calibrate based on production observation.
const INBOUND_FACTS_MAX = 500;
const RELAY_EVIDENCE_MAX = 500;

export const compareCursorPosition = (
  aTimestamp: string,
  aTraceId: string,
  bTimestamp: string,
  bTraceId: string,
): number => {
  if (aTimestamp < bTimestamp) return -1;
  if (aTimestamp > bTimestamp) return 1;
  if (aTraceId < bTraceId) return -1;
  if (aTraceId > bTraceId) return 1;
  return 0;
};

/**
 * Creates an empty BridgeDurableState for a given agent.
 */
const createEmptyState = (agentId: string): BridgeDurableState => ({
  schema_version: SCHEMA_VERSION,
  agent_id: agentId,
  cursor: {
    last_completed_trace_id: null,
    last_completed_timestamp: null,
  },
  continuity: {},
  inbound_facts: {},
  relay_evidence: {},
});

/**
 * Manages durable state persistence for a single Bridge agent.
 *
 * All writes are atomic (write-to-temp + rename).
 * All state mutations return new copies (immutability).
 */
export class DurableStateManager {
  private readonly stateDir: string;
  private readonly agentId: string;
  private readonly filePath: string;
  private readonly tmpPath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(stateDir: string, agentId: string) {
    this.stateDir = stateDir;
    this.agentId = agentId;
    this.filePath = path.join(stateDir, `${agentId}.json`);
    this.tmpPath = this.filePath + '.tmp';
  }

  /**
   * Atomic read-modify-write protected by a process-wide async mutex.
   * The mutator receives the current state and returns the new state to persist.
   * Concurrent calls are serialized — no cross-route interleaving.
   */
  async mutate(
    fn: (state: BridgeDurableState) => Promise<BridgeDurableState> | BridgeDurableState,
  ): Promise<BridgeDurableState> {
    const prev = this.writeLock;
    const { promise, resolve } = this.createDeferred();
    this.writeLock = promise;

    await prev;
    try {
      const state = this.load();
      const next = await fn(state);
      const pruned = this.pruneState(next);
      this.save(pruned);
      return pruned;
    } finally {
      resolve();
    }
  }

  /**
   * Prune finalized inbound facts when over cap.
   * Prunable: terminal_disposition != null OR (delivery_evidence != null AND cursor_advanced).
   * Invariant: retryable facts (no terminal, no confirmed delivery) are NEVER evicted.
   * If prunable count < deficit, state may remain over cap.
   */
  private pruneInboundFacts(state: BridgeDurableState): BridgeDurableState {
    const entries = Object.entries(state.inbound_facts);
    if (entries.length <= INBOUND_FACTS_MAX) return state;

    const prunable = entries.filter(([, f]) =>
      f.terminal_disposition !== null ||
      (f.delivery_evidence !== null && f.cursor_advanced),
    );
    if (prunable.length === 0) return state;

    const deficit = entries.length - INBOUND_FACTS_MAX;
    const evictKeys = new Set(
      [...prunable]
        .sort((a, b) => a[1].observed_at.localeCompare(b[1].observed_at))
        .slice(0, deficit)
        .map(([k]) => k),
    );

    return {
      ...state,
      inbound_facts: Object.fromEntries(entries.filter(([k]) => !evictKeys.has(k))),
    };
  }

  /**
   * Prune confirmed relay evidence when over cap.
   * Prunable: confirmed == true only.
   * Invariant: unconfirmed relays are NEVER evicted.
   * If prunable count < deficit, state may remain over cap.
   */
  private pruneRelayEvidence(state: BridgeDurableState): BridgeDurableState {
    const entries = Object.entries(state.relay_evidence);
    if (entries.length <= RELAY_EVIDENCE_MAX) return state;

    const prunable = entries.filter(([, r]) => r.confirmed);
    if (prunable.length === 0) return state;

    const deficit = entries.length - RELAY_EVIDENCE_MAX;
    const evictKeys = new Set(
      [...prunable]
        .sort((a, b) => (a[1].submitted_at ?? '').localeCompare(b[1].submitted_at ?? ''))
        .slice(0, deficit)
        .map(([k]) => k),
    );

    return {
      ...state,
      relay_evidence: Object.fromEntries(entries.filter(([k]) => !evictKeys.has(k))),
    };
  }

  private pruneState(state: BridgeDurableState): BridgeDurableState {
    return this.pruneRelayEvidence(this.pruneInboundFacts(state));
  }

  private createDeferred(): { promise: Promise<void>; resolve: () => void } {
    const holder: { resolve: () => void } = { resolve: () => {} };
    const promise = new Promise<void>((r) => { holder.resolve = r; });
    return { promise, resolve: holder.resolve };
  }

  /**
   * Load state from disk.
   * - Missing file -> returns valid empty state
   * - Corrupted JSON -> throws descriptive error
   * - Schema version mismatch -> throws migration-required error
   */
  load(): BridgeDurableState {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyState(this.agentId);
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');

    const parsed = this.parseJson(raw);
    this.validateSchemaVersion(parsed);

    return parsed as unknown as BridgeDurableState;
  }

  /**
   * Persist state to disk using atomic write-to-temp + rename.
   */
  save(state: BridgeDurableState): void {
    const json = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.tmpPath, json, 'utf-8');
    fs.renameSync(this.tmpPath, this.filePath);
  }

  /**
   * Returns a new state with cursor advanced to the given trace_id and timestamp.
   * Does NOT mutate the input state.
   */
  advanceCursor(
    state: BridgeDurableState,
    traceId: string,
    hubTimestamp: string
  ): BridgeDurableState {
    const currentTimestamp = state.cursor.last_completed_timestamp;
    const currentTraceId = state.cursor.last_completed_trace_id;
    if (
      currentTimestamp !== null &&
      currentTraceId !== null &&
      compareCursorPosition(hubTimestamp, traceId, currentTimestamp, currentTraceId) < 0
    ) {
      return state;
    }

    return {
      ...state,
      cursor: {
        last_completed_trace_id: traceId,
        last_completed_timestamp: hubTimestamp,
      },
    };
  }

  // --- Getters ---

  getInboundFact(
    state: BridgeDurableState,
    traceId: string
  ): InboundFact | null {
    return state.inbound_facts[traceId] ?? null;
  }

  getContinuity(
    state: BridgeDurableState,
    routeKey: string
  ): ContinuityEntry | null {
    return state.continuity[routeKey] ?? null;
  }

  getRelayEvidence(
    state: BridgeDurableState,
    outboundId: string
  ): RelayRecord | null {
    return state.relay_evidence[outboundId] ?? null;
  }

  // --- Setters (immutable — return new state) ---

  setInboundFact(
    state: BridgeDurableState,
    traceId: string,
    fact: InboundFact
  ): BridgeDurableState {
    return {
      ...state,
      inbound_facts: {
        ...state.inbound_facts,
        [traceId]: fact,
      },
    };
  }

  setContinuity(
    state: BridgeDurableState,
    routeKey: string,
    entry: ContinuityEntry
  ): BridgeDurableState {
    return {
      ...state,
      continuity: {
        ...state.continuity,
        [routeKey]: entry,
      },
    };
  }

  setRelayEvidence(
    state: BridgeDurableState,
    outboundId: string,
    record: RelayRecord
  ): BridgeDurableState {
    return {
      ...state,
      relay_evidence: {
        ...state.relay_evidence,
        [outboundId]: record,
      },
    };
  }

  // --- Private helpers ---

  private parseJson(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Corrupted state file at ${this.filePath}: failed to parse JSON`
      );
    }
  }

  private validateSchemaVersion(parsed: Record<string, unknown>): void {
    if (parsed.schema_version !== SCHEMA_VERSION) {
      throw new Error(
        `Migration required: state file has schema_version "${parsed.schema_version}", expected "${SCHEMA_VERSION}"`
      );
    }
  }
}
