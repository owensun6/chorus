// Author: be-domain-modeler
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InboundPipeline } from '../../src/bridge/inbound';
import { DurableStateManager } from '../../src/bridge/state';
import type { HostAdapter, DeliveryReceipt, BridgeDurableState } from '../../src/bridge/types';
import type { HubSSEEvent } from '../../src/bridge/hub-client';

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbound-test-'));
  return dir;
};

const makeEvent = (overrides: Partial<HubSSEEvent> = {}): HubSSEEvent => ({
  trace_id: 'trace-001',
  sender_id: 'remote@hub',
  envelope: {
    chorus_version: '0.4',
    sender_id: 'remote@hub',
    original_text: 'Hello',
    sender_culture: 'en',
  },
  hub_timestamp: '2026-03-24T12:00:00.000Z',
  ...overrides,
});

const makeHostAdapter = (
  overrides: Partial<HostAdapter> = {},
): HostAdapter => ({
  adaptContent: jest.fn().mockResolvedValue('Adapted text'),
  deliverInbound: jest.fn().mockResolvedValue({
    status: 'confirmed',
    method: 'test',
    ref: 'ref-1',
    timestamp: '2026-03-24T12:00:01.000Z',
  } as DeliveryReceipt),
  onReplyDetected: jest.fn(),
  resolveLocalAnchor: jest.fn().mockResolvedValue('anchor-1'),
  acquireHandles: jest.fn().mockResolvedValue(undefined),
  releaseHandles: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const AGENT_ID = 'local@hub';
const CONFIG = { localAgentId: AGENT_ID, localCulture: 'zh-CN' };

// ---------------------------------------------------------------------------
// test_new_message
// ---------------------------------------------------------------------------

describe('InboundPipeline', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('test_new_message: full pipeline creates fact, records delivery, advances cursor', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter();
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();

    // Inbound fact created
    const fact = state.inbound_facts['trace-001'];
    expect(fact).toBeDefined();
    expect(fact.route_key).toBe('local@hub:remote@hub');
    expect(fact.dedupe_result).toBe('new');
    expect(fact.hub_timestamp).toBe('2026-03-24T12:00:00.000Z');

    // Delivery evidence recorded
    expect(fact.delivery_evidence).not.toBeNull();
    expect(fact.delivery_evidence!.method).toBe('test');

    // Cursor advanced
    expect(fact.cursor_advanced).toBe(true);
    expect(state.cursor.last_completed_trace_id).toBe('trace-001');
    expect(state.cursor.last_completed_timestamp).toBe('2026-03-24T12:00:00.000Z');

    // Host adapter called
    expect(hostAdapter.adaptContent).toHaveBeenCalledTimes(1);
    expect(hostAdapter.deliverInbound).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // test_dedupe
  // ---------------------------------------------------------------------------

  it('test_dedupe: duplicate trace_id sets terminal_disposition, no delivery attempt', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter();
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    // First processing
    await pipeline.processMessage(makeEvent());
    expect(hostAdapter.deliverInbound).toHaveBeenCalledTimes(1);

    // Second processing — same trace_id
    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();
    const fact = state.inbound_facts['trace-001'];
    expect(fact.dedupe_result).toBe('duplicate');
    expect(fact.terminal_disposition).not.toBeNull();
    expect(fact.terminal_disposition!.reason).toBe('duplicate');

    // deliverInbound NOT called a second time
    expect(hostAdapter.deliverInbound).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // test_delivery_transient_throw
  // ---------------------------------------------------------------------------

  it('test_delivery_transient_throw: host adapter throws → no terminal_disposition, fact stays retryable', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const errors: string[] = [];
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG, (msg) => errors.push(msg));

    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();
    const fact = state.inbound_facts['trace-001'];

    expect(fact.delivery_evidence).toBeNull();
    expect(fact.terminal_disposition).toBeNull();
    expect(fact.cursor_advanced).toBe(false);
    expect(state.cursor.last_completed_trace_id).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Transient');
  });

  // ---------------------------------------------------------------------------
  // test_delivery_permanent_failed
  // ---------------------------------------------------------------------------

  it('test_delivery_permanent_failed: host returns status="failed" → terminal_disposition, cursor advances', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockResolvedValue({
        status: 'failed',
        method: 'test',
        ref: null,
        timestamp: '2026-03-24T12:00:01.000Z',
      } as DeliveryReceipt),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();
    const fact = state.inbound_facts['trace-001'];

    expect(fact.terminal_disposition).not.toBeNull();
    expect(fact.terminal_disposition!.reason).toBe('delivery_failed_permanent');
    expect(fact.delivery_evidence).toBeNull();
    expect(fact.cursor_advanced).toBe(true);
    expect(state.cursor.last_completed_trace_id).toBe('trace-001');
  });

  // ---------------------------------------------------------------------------
  // test_delivery_unverifiable
  // ---------------------------------------------------------------------------

  it('test_delivery_unverifiable: host returns status="unverifiable" → terminal_disposition, NO delivery_evidence', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockResolvedValue({
        status: 'unverifiable',
        method: 'fire-and-forget',
        ref: null,
        timestamp: '2026-03-24T12:00:01.000Z',
      } as DeliveryReceipt),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();
    const fact = state.inbound_facts['trace-001'];

    expect(fact.terminal_disposition).not.toBeNull();
    expect(fact.terminal_disposition!.reason).toBe('delivery_unverifiable');
    expect(fact.delivery_evidence).toBeNull();
    expect(fact.cursor_advanced).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // test_local_anchor_id_persisted
  // ---------------------------------------------------------------------------

  it('test_local_anchor_id_persisted: resolveLocalAnchor called once and persisted to continuity', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const resolveLocal = jest.fn().mockResolvedValue('anchor-resolved');
    const hostAdapter = makeHostAdapter({ resolveLocalAnchor: resolveLocal });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    // First message — should call resolveLocalAnchor
    await pipeline.processMessage(makeEvent({ trace_id: 'anc-1' }));

    const state1 = stateManager.load();
    const routeKey = 'local@hub:remote@hub';
    expect(state1.continuity[routeKey].local_anchor_id).toBe('anchor-resolved');
    expect(resolveLocal).toHaveBeenCalledTimes(1);

    // Second message from same peer — should NOT call resolveLocalAnchor again
    await pipeline.processMessage(makeEvent({ trace_id: 'anc-2' }));
    expect(resolveLocal).toHaveBeenCalledTimes(1);

    const state2 = stateManager.load();
    expect(state2.continuity[routeKey].local_anchor_id).toBe('anchor-resolved');
  });

  // ---------------------------------------------------------------------------
  // test_pipeline_continues_after_throw
  // ---------------------------------------------------------------------------

  it('test_pipeline_continues_after_throw: transient throw on one message does not block different route', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const callCount = { n: 0 };
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(async () => {
        callCount.n++;
        if (callCount.n === 1) {
          throw new Error('First message fails');
        }
        return { status: 'confirmed', method: 'test', ref: null, timestamp: new Date().toISOString() };
      }),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG, () => {});

    // First message fails (transient)
    await pipeline.processMessage(makeEvent({ trace_id: 'fail-trace', sender_id: 'peer-a@hub' }));
    // Second message from different sender succeeds
    await pipeline.processMessage(makeEvent({ trace_id: 'ok-trace', sender_id: 'peer-b@hub' }));

    const state = stateManager.load();
    expect(state.inbound_facts['fail-trace'].cursor_advanced).toBe(false);
    expect(state.inbound_facts['ok-trace'].cursor_advanced).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // test_cross_route_no_overwrite
  // ---------------------------------------------------------------------------

  it('test_cross_route_no_overwrite: concurrent different-route updates do not lose earlier writes', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(async () => {
        // Simulate async delivery taking some time
        await new Promise((r) => setTimeout(r, 30));
        return { status: 'confirmed', method: 'test', ref: 'r', timestamp: new Date().toISOString() };
      }),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    // Launch TWO messages from DIFFERENT peers concurrently
    const p1 = pipeline.processMessage(makeEvent({ trace_id: 'route-a-msg', sender_id: 'peer-a@hub' }));
    const p2 = pipeline.processMessage(makeEvent({ trace_id: 'route-b-msg', sender_id: 'peer-b@hub' }));
    await Promise.all([p1, p2]);

    const state = stateManager.load();

    // BOTH inbound facts must exist — neither should be lost
    expect(state.inbound_facts['route-a-msg']).toBeDefined();
    expect(state.inbound_facts['route-b-msg']).toBeDefined();
    expect(state.inbound_facts['route-a-msg'].cursor_advanced).toBe(true);
    expect(state.inbound_facts['route-b-msg'].cursor_advanced).toBe(true);

    // Both continuity entries must exist
    expect(state.continuity['local@hub:peer-a@hub']).toBeDefined();
    expect(state.continuity['local@hub:peer-b@hub']).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // test_delivery_timeout
  // ---------------------------------------------------------------------------

  it('test_delivery_timeout: hung deliverInbound becomes unverifiable, NOT retryable (prevents duplicate delivery)', async () => {
    jest.useFakeTimers();
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(() => new Promise(() => {})),
    });
    const errors: string[] = [];
    const pipeline = new InboundPipeline(
      stateManager, hostAdapter,
      { localAgentId: AGENT_ID, localCulture: 'zh-CN', deliverTimeoutMs: 100 },
      (msg) => errors.push(msg),
    );

    const processing = pipeline.processMessage(makeEvent({ trace_id: 'timeout-trace' }));
    await jest.advanceTimersByTimeAsync(150);
    await processing;

    jest.useRealTimers();

    const state = stateManager.load();
    const fact = state.inbound_facts['timeout-trace'];

    // Timeout = unverifiable: send may have completed, so NOT retryable
    expect(fact.terminal_disposition).not.toBeNull();
    expect(fact.terminal_disposition!.reason).toBe('delivery_unverifiable');
    expect(fact.delivery_evidence).toBeNull();
    expect(fact.cursor_advanced).toBe(true);
    expect(state.cursor.last_completed_trace_id).toBe('timeout-trace');
    expect(errors.some((e) => e.includes('unverifiable'))).toBe(true);
  });

  it('test_timeout_no_duplicate_delivery: recovery does NOT re-deliver after timeout', async () => {
    jest.useFakeTimers();
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const deliverCalls: string[] = [];
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(async (params: { metadata: { trace_id: string } }) => {
        deliverCalls.push(params.metadata.trace_id);
        if (deliverCalls.length === 1) {
          return new Promise(() => {});
        }
        return { status: 'confirmed', method: 'test', ref: null, timestamp: new Date().toISOString() };
      }),
    });
    const pipeline = new InboundPipeline(
      stateManager, hostAdapter,
      { localAgentId: AGENT_ID, localCulture: 'zh-CN', deliverTimeoutMs: 100 },
    );

    // First attempt: times out → unverifiable
    const p1 = pipeline.processMessage(makeEvent({ trace_id: 'no-dup-trace' }));
    await jest.advanceTimersByTimeAsync(150);
    await p1;

    jest.useRealTimers();

    const stateAfterTimeout = stateManager.load();
    expect(stateAfterTimeout.inbound_facts['no-dup-trace'].terminal_disposition!.reason).toBe('delivery_unverifiable');
    expect(stateAfterTimeout.inbound_facts['no-dup-trace'].cursor_advanced).toBe(true);

    // Second attempt: same trace_id — pipeline dedupes, does NOT re-deliver
    await pipeline.processMessage(makeEvent({ trace_id: 'no-dup-trace' }));

    expect(deliverCalls).toHaveLength(1);

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['no-dup-trace'].dedupe_result).toBe('duplicate');
  });

  // ---------------------------------------------------------------------------
  // test_cursor_not_advanced_without_evidence
  // ---------------------------------------------------------------------------

  it('test_cursor_not_advanced_without_evidence: no delivery → cursor unchanged', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockRejectedValue(new Error('crash')),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG, () => {});

    await pipeline.processMessage(makeEvent());

    const state = stateManager.load();
    expect(state.cursor.last_completed_trace_id).toBeNull();
    expect(state.cursor.last_completed_timestamp).toBeNull();
    expect(state.inbound_facts['trace-001'].cursor_advanced).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // test_per_route_lock
  // ---------------------------------------------------------------------------

  it('test_per_route_lock: concurrent messages from same peer → sequential processing', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const callOrder: string[] = [];
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(async (params: { metadata: { trace_id: string } }) => {
        callOrder.push(`start:${params.metadata.trace_id}`);
        await new Promise((r) => setTimeout(r, 20));
        callOrder.push(`end:${params.metadata.trace_id}`);
        return { status: 'confirmed', method: 'test', ref: null, timestamp: new Date().toISOString() };
      }),
    });
    const pipeline = new InboundPipeline(stateManager, hostAdapter, CONFIG);

    // Launch concurrently — same sender (same route_key)
    const p1 = pipeline.processMessage(makeEvent({ trace_id: 'c-1' }));
    const p2 = pipeline.processMessage(makeEvent({ trace_id: 'c-2' }));
    await Promise.all([p1, p2]);

    // With lock: start:c-1, end:c-1, start:c-2, end:c-2
    // Without lock: start:c-1, start:c-2 would interleave
    expect(callOrder[0]).toBe('start:c-1');
    expect(callOrder[1]).toBe('end:c-1');
    expect(callOrder[2]).toBe('start:c-2');
    expect(callOrder[3]).toBe('end:c-2');
  });
});
