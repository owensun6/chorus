// Author: be-domain-modeler
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DurableStateManager } from '../../src/bridge/state';
import { computeRouteKey } from '../../src/bridge/route-key';
import type { BridgeDurableState, InboundFact, RelayRecord } from '../../src/bridge/types';

describe('DurableStateManager', () => {
  const createTempDir = (): string => {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-state-test-'));
  };

  const cleanupDir = (dir: string): void => {
    fs.rmSync(dir, { recursive: true, force: true });
  };

  describe('test_load_empty', () => {
    it('should return a valid empty BridgeDurableState when no file exists', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'xiaov@openclaw');
        const state = manager.load();

        expect(state.schema_version).toBe('2.0');
        expect(state.agent_id).toBe('xiaov@openclaw');
        expect(state.cursor.last_completed_trace_id).toBeNull();
        expect(state.cursor.last_completed_timestamp).toBeNull();
        expect(state.continuity).toEqual({});
        expect(state.inbound_facts).toEqual({});
        expect(state.relay_evidence).toEqual({});
      } finally {
        cleanupDir(tempDir);
      }
    });
  });

  describe('test_save_load_roundtrip', () => {
    it('should persist state and reload identically', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'xiaov@openclaw');
        const emptyState = manager.load();

        const stateWithFact: BridgeDurableState = {
          ...emptyState,
          inbound_facts: {
            'trace-001': {
              route_key: 'xiaov@openclaw:xiaox@chorus',
              observed_at: '2026-03-24T10:00:00Z',
              hub_timestamp: '2026-03-24T09:59:59Z',
              dedupe_result: 'new',
              delivery_evidence: null,
              terminal_disposition: null,
              cursor_advanced: false,
            },
          },
        };

        manager.save(stateWithFact);

        const reloaded = manager.load();
        expect(reloaded).toEqual(stateWithFact);
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('should preserve all state sections through save/load cycle', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const fullState: BridgeDurableState = {
          schema_version: '2.0',
          agent_id: 'agent-a',
          cursor: {
            last_completed_trace_id: 'trace-100',
            last_completed_timestamp: '2026-03-24T12:00:00Z',
          },
          continuity: {
            'agent-a:agent-b': {
              remote_peer_id: 'agent-b',
              local_anchor_id: 'session-42',
              conversation_id: 'conv-xyz',
              last_inbound_turn: 5,
              last_outbound_turn: 4,
              created_at: '2026-03-24T10:00:00Z',
              updated_at: '2026-03-24T12:00:00Z',
            },
          },
          inbound_facts: {
            'trace-100': {
              route_key: 'agent-a:agent-b',
              observed_at: '2026-03-24T11:00:00Z',
              hub_timestamp: '2026-03-24T10:59:00Z',
              dedupe_result: 'new',
              delivery_evidence: {
                delivered_at: '2026-03-24T11:01:00Z',
                method: 'weixin',
                ref: 'msg-ref-001',
              },
              terminal_disposition: null,
              cursor_advanced: true,
            },
          },
          relay_evidence: {
            'out-001': {
              inbound_trace_id: 'trace-100',
              route_key: 'agent-a:agent-b',
              reply_text: 'Hello from A!',
              bound_turn_number: 5,
              idempotency_key: 'idem-001',
              submitted_at: '2026-03-24T11:05:00Z',
              hub_trace_id: 'hub-trace-001',
              confirmed: true,
            },
          },
        };

        manager.save(fullState);
        const reloaded = manager.load();
        expect(reloaded).toEqual(fullState);
      } finally {
        cleanupDir(tempDir);
      }
    });
  });

  describe('test_atomic_write', () => {
    it('should write atomically: original file survives if .tmp exists (crash simulation)', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'xiaov@openclaw');

        // Save initial state
        const initialState = manager.load();
        manager.save(initialState);

        const mainPath = path.join(tempDir, 'xiaov@openclaw.json');
        const tmpPath = mainPath + '.tmp';

        // Simulate a crash: write a .tmp file with new data but do NOT rename
        const corruptedTmpContent = JSON.stringify({ schema_version: '2.0', agent_id: 'xiaov@openclaw', partial: true });
        fs.writeFileSync(tmpPath, corruptedTmpContent, 'utf-8');

        // On "recovery" (re-load), original file should be intact
        const recovered = manager.load();
        expect(recovered).toEqual(initialState);
        expect(recovered.schema_version).toBe('2.0');

        // The .tmp file should be ignored by load
        expect(fs.existsSync(tmpPath)).toBe(true); // still there (orphaned)
        expect(fs.existsSync(mainPath)).toBe(true);
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('should not leave a .tmp file after successful save', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'xiaov@openclaw');
        const state = manager.load();
        manager.save(state);

        const tmpPath = path.join(tempDir, 'xiaov@openclaw.json.tmp');
        expect(fs.existsSync(tmpPath)).toBe(false);

        const mainPath = path.join(tempDir, 'xiaov@openclaw.json');
        expect(fs.existsSync(mainPath)).toBe(true);
      } finally {
        cleanupDir(tempDir);
      }
    });
  });

  describe('test_advance_cursor', () => {
    it('should update cursor fields atomically', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state = manager.load();

        const advanced = manager.advanceCursor(state, 'trace-42', '2026-03-24T15:00:00Z');

        expect(advanced.cursor.last_completed_trace_id).toBe('trace-42');
        expect(advanced.cursor.last_completed_timestamp).toBe('2026-03-24T15:00:00Z');
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('should return a new state object (immutability)', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state = manager.load();

        const advanced = manager.advanceCursor(state, 'trace-42', '2026-03-24T15:00:00Z');

        // Original state must not be mutated
        expect(state.cursor.last_completed_trace_id).toBeNull();
        expect(state.cursor.last_completed_timestamp).toBeNull();

        // New state has updated cursor
        expect(advanced.cursor.last_completed_trace_id).toBe('trace-42');
        expect(advanced).not.toBe(state);
      } finally {
        cleanupDir(tempDir);
      }
    });
  });

  describe('error handling', () => {
    it('should throw on corrupted JSON file', () => {
      const tempDir = createTempDir();
      try {
        const filePath = path.join(tempDir, 'agent-a.json');
        fs.writeFileSync(filePath, '{ broken json !!!', 'utf-8');

        const manager = new DurableStateManager(tempDir, 'agent-a');
        expect(() => manager.load()).toThrow(/corrupted|parse/i);
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('should throw migration-required error on schema_version mismatch', () => {
      const tempDir = createTempDir();
      try {
        const filePath = path.join(tempDir, 'agent-a.json');
        const oldState = {
          schema_version: '1.0',
          agent_id: 'agent-a',
          cursor: { last_completed_trace_id: null, last_completed_timestamp: null },
          continuity: {},
          inbound_facts: {},
          relay_evidence: {},
        };
        fs.writeFileSync(filePath, JSON.stringify(oldState), 'utf-8');

        const manager = new DurableStateManager(tempDir, 'agent-a');
        expect(() => manager.load()).toThrow(/migration.required/i);
      } finally {
        cleanupDir(tempDir);
      }
    });
  });

  describe('getters and setters', () => {
    it('getInboundFact should return fact by trace_id', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state: BridgeDurableState = {
          ...manager.load(),
          inbound_facts: {
            'trace-1': {
              route_key: 'agent-a:agent-b',
              observed_at: '2026-03-24T10:00:00Z',
              hub_timestamp: '2026-03-24T09:59:00Z',
              dedupe_result: null,
              delivery_evidence: null,
              terminal_disposition: null,
              cursor_advanced: false,
            },
          },
        };

        const fact = manager.getInboundFact(state, 'trace-1');
        expect(fact).not.toBeNull();
        expect(fact!.route_key).toBe('agent-a:agent-b');

        const missing = manager.getInboundFact(state, 'nonexistent');
        expect(missing).toBeNull();
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('setInboundFact should return new state with updated fact', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state = manager.load();

        const newFact = {
          route_key: 'agent-a:agent-b',
          observed_at: '2026-03-24T10:00:00Z',
          hub_timestamp: '2026-03-24T09:59:00Z',
          dedupe_result: null as 'new' | 'duplicate' | null,
          delivery_evidence: null,
          terminal_disposition: null,
          cursor_advanced: false,
        };

        const updated = manager.setInboundFact(state, 'trace-new', newFact);

        // Immutability: original untouched
        expect(state.inbound_facts['trace-new']).toBeUndefined();
        // New state has the fact
        expect(updated.inbound_facts['trace-new']).toEqual(newFact);
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('getContinuity should return entry by route_key', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state: BridgeDurableState = {
          ...manager.load(),
          continuity: {
            'agent-a:agent-b': {
              remote_peer_id: 'agent-b',
              local_anchor_id: 'anchor-1',
              conversation_id: null,
              last_inbound_turn: 1,
              last_outbound_turn: 0,
              created_at: '2026-03-24T10:00:00Z',
              updated_at: '2026-03-24T10:00:00Z',
            },
          },
        };

        const entry = manager.getContinuity(state, 'agent-a:agent-b');
        expect(entry).not.toBeNull();
        expect(entry!.remote_peer_id).toBe('agent-b');

        const missing = manager.getContinuity(state, 'nonexistent');
        expect(missing).toBeNull();
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('setContinuity should return new state with updated entry', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state = manager.load();

        const entry = {
          remote_peer_id: 'agent-b',
          local_anchor_id: 'anchor-1',
          conversation_id: null as string | null,
          last_inbound_turn: 1,
          last_outbound_turn: 0,
          created_at: '2026-03-24T10:00:00Z',
          updated_at: '2026-03-24T10:00:00Z',
        };

        const updated = manager.setContinuity(state, 'agent-a:agent-b', entry);
        expect(state.continuity['agent-a:agent-b']).toBeUndefined();
        expect(updated.continuity['agent-a:agent-b']).toEqual(entry);
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('getRelayEvidence should return record by outbound_id', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state: BridgeDurableState = {
          ...manager.load(),
          relay_evidence: {
            'out-1': {
              inbound_trace_id: 'trace-1',
              route_key: 'agent-a:agent-b',
              reply_text: 'Hello!',
              bound_turn_number: 1,
              idempotency_key: 'idem-1',
              submitted_at: null,
              hub_trace_id: null,
              confirmed: false,
            },
          },
        };

        const record = manager.getRelayEvidence(state, 'out-1');
        expect(record).not.toBeNull();
        expect(record!.reply_text).toBe('Hello!');

        const missing = manager.getRelayEvidence(state, 'nonexistent');
        expect(missing).toBeNull();
      } finally {
        cleanupDir(tempDir);
      }
    });

    it('setRelayEvidence should return new state with updated record', () => {
      const tempDir = createTempDir();
      try {
        const manager = new DurableStateManager(tempDir, 'agent-a');
        const state = manager.load();

        const record = {
          inbound_trace_id: 'trace-1' as string | null,
          route_key: 'agent-a:agent-b',
          reply_text: 'Reply!',
          bound_turn_number: 1,
          idempotency_key: 'idem-1',
          submitted_at: null as string | null,
          hub_trace_id: null as string | null,
          confirmed: false,
        };

        const updated = manager.setRelayEvidence(state, 'out-new', record);
        expect(state.relay_evidence['out-new']).toBeUndefined();
        expect(updated.relay_evidence['out-new']).toEqual(record);
      } finally {
        cleanupDir(tempDir);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Pruning invariants (T-03)
// ---------------------------------------------------------------------------

describe('DurableStateManager pruning', () => {
  const createTempDir = (): string =>
    fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-prune-test-'));
  const cleanupDir = (dir: string): void =>
    fs.rmSync(dir, { recursive: true, force: true });

  const retryableFact = {
    route_key: 'a:b',
    observed_at: '2026-03-24T10:00:00Z',
    hub_timestamp: '2026-03-24T09:59:00Z',
    dedupe_result: null as null,
    delivery_evidence: null,
    terminal_disposition: null,
    cursor_advanced: false,
  };

  const finalizedFact = (timestamp: string) => ({
    route_key: 'a:b',
    observed_at: timestamp,
    hub_timestamp: timestamp,
    dedupe_result: 'new' as const,
    delivery_evidence: null,
    terminal_disposition: { reason: 'duplicate' as const, decided_at: timestamp },
    cursor_advanced: false,
  });

  const unconfirmedRelay = {
    inbound_trace_id: null,
    route_key: 'a:b',
    reply_text: 'hi',
    bound_turn_number: 1,
    idempotency_key: 'idem-u',
    submitted_at: null,
    hub_trace_id: null,
    confirmed: false,
  };

  const confirmedRelay = (ts: string) => ({
    inbound_trace_id: null,
    route_key: 'a:b',
    reply_text: 'hi',
    bound_turn_number: 1,
    idempotency_key: `idem-${ts}`,
    submitted_at: ts,
    hub_trace_id: 'hub-trace',
    confirmed: true,
  });

  it('test_prune_preserves_retryable_fact: retryable inbound fact survives pruning', async () => {
    const tempDir = createTempDir();
    try {
      const manager = new DurableStateManager(tempDir, 'agent-prune');
      // Build 501 inbound_facts: 500 finalized + 1 retryable
      const facts: Record<string, InboundFact> = {};
      for (let i = 0; i < 500; i++) {
        facts[`finalized-${i}`] = finalizedFact(`2026-01-01T${String(i).padStart(5, '0')}Z`);
      }
      facts['retryable-keep'] = retryableFact;
      const state: BridgeDurableState = { ...manager.load(), inbound_facts: facts };
      manager.save(state);

      const result = await manager.mutate((s) => s);

      expect(result.inbound_facts['retryable-keep']).toBeDefined();
    } finally {
      cleanupDir(tempDir);
    }
  });

  it('test_prune_preserves_unconfirmed_relay: unconfirmed relay record survives pruning', async () => {
    const tempDir = createTempDir();
    try {
      const manager = new DurableStateManager(tempDir, 'agent-prune');
      // Build 501 relay_evidence: 500 confirmed + 1 unconfirmed
      const relays: Record<string, RelayRecord> = {};
      for (let i = 0; i < 500; i++) {
        relays[`confirmed-${i}`] = confirmedRelay(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`);
      }
      relays['unconfirmed-keep'] = unconfirmedRelay;
      const state: BridgeDurableState = { ...manager.load(), relay_evidence: relays };
      manager.save(state);

      const result = await manager.mutate((s) => s);

      expect(result.relay_evidence['unconfirmed-keep']).toBeDefined();
    } finally {
      cleanupDir(tempDir);
    }
  });

  it('test_prune_stays_over_cap_when_no_prunable: state may exceed cap if all records are retryable', async () => {
    const tempDir = createTempDir();
    try {
      const manager = new DurableStateManager(tempDir, 'agent-prune');
      // Build 502 retryable inbound_facts — none prunable
      const facts: Record<string, InboundFact> = {};
      for (let i = 0; i < 502; i++) {
        facts[`retryable-${i}`] = retryableFact;
      }
      const state: BridgeDurableState = { ...manager.load(), inbound_facts: facts };
      manager.save(state);

      const result = await manager.mutate((s) => s);

      expect(Object.keys(result.inbound_facts)).toHaveLength(502);
    } finally {
      cleanupDir(tempDir);
    }
  });
});

describe('computeRouteKey', () => {
  describe('test_route_key', () => {
    it('should produce deterministic route key', () => {
      const result = computeRouteKey('xiaov@openclaw', 'xiaox@chorus');
      expect(result).toBe('xiaov@openclaw:xiaox@chorus');
    });

    it('should be direction-aware (order matters)', () => {
      const forward = computeRouteKey('xiaov@openclaw', 'xiaox@chorus');
      const reverse = computeRouteKey('xiaox@chorus', 'xiaov@openclaw');
      expect(forward).not.toBe(reverse);
      expect(forward).toBe('xiaov@openclaw:xiaox@chorus');
      expect(reverse).toBe('xiaox@chorus:xiaov@openclaw');
    });

    it('should handle same agent on both sides', () => {
      const result = computeRouteKey('agent@host', 'agent@host');
      expect(result).toBe('agent@host:agent@host');
    });
  });
});
