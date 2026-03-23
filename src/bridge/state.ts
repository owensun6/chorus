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

  constructor(stateDir: string, agentId: string) {
    this.stateDir = stateDir;
    this.agentId = agentId;
    this.filePath = path.join(stateDir, `${agentId}.json`);
    this.tmpPath = this.filePath + '.tmp';
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
