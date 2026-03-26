// Author: be-domain-modeler
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RecoveryEngine, filterBeyondCursor } from '../../src/bridge/recovery';
import { DurableStateManager } from '../../src/bridge/state';
import type {
  InboundFact,
  RelayRecord,
  ContinuityEntry,
  HostAdapter,
  DeliveryReceipt,
} from '../../src/bridge/types';
import { InboundPipeline } from '../../src/bridge/inbound';
import { OutboundPipeline } from '../../src/bridge/outbound';
import type { HubClient, HubHistoryMessage, HubSSEEvent, SSECallback } from '../../src/bridge/hub-client';

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-test-'));

const AGENT_ID = 'local@hub';
const API_KEY = 'test-key';
const ROUTE_KEY = 'local@hub:remote@hub';

const makeHostAdapter = (overrides: Partial<HostAdapter> = {}): HostAdapter => ({
  adaptContent: jest.fn().mockResolvedValue('adapted'),
  deliverInbound: jest.fn().mockResolvedValue({
    status: 'confirmed', method: 'test', ref: null, timestamp: new Date().toISOString(),
  } as DeliveryReceipt),
  onReplyDetected: jest.fn(),
  resolveLocalAnchor: jest.fn().mockResolvedValue('anchor-1'),
  acquireHandles: jest.fn().mockResolvedValue(undefined),
  releaseHandles: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeHubClient = (history: HubHistoryMessage[] = []): HubClient => ({
  fetchHistory: jest.fn().mockResolvedValue(history),
  submitRelay: jest.fn().mockResolvedValue({ trace_id: 'hub-t-1', delivery: 'delivered' }),
  connectSSE: jest.fn(),
  disconnect: jest.fn(),
} as unknown as HubClient);

const makeHubMsg = (traceId: string, timestamp: string, text: string = 'Hello'): HubHistoryMessage => ({
  trace_id: traceId,
  sender_id: 'remote@hub',
  receiver_id: AGENT_ID,
  envelope: { chorus_version: '0.4', sender_id: 'remote@hub', original_text: text, sender_culture: 'en' } as any,
  delivered_via: 'sse',
  timestamp,
});

const makeHubMsgFor = (
  traceId: string,
  timestamp: string,
  overrides: Partial<HubHistoryMessage> = {},
): HubHistoryMessage => ({
  trace_id: traceId,
  sender_id: 'remote@hub',
  receiver_id: AGENT_ID,
  envelope: {
    chorus_version: '0.4',
    sender_id: 'remote@hub',
    original_text: 'Hello',
    sender_culture: 'en',
  } as any,
  delivered_via: 'sse',
  timestamp,
  ...overrides,
});

const makeProjection = (text: string = 'Hello') => ({
  original_text: text,
  sender_culture: 'en',
  cultural_context: null,
  conversation_id: null,
  turn_number: 1,
});

const seedContinuity = (stateManager: DurableStateManager): void => {
  const state = stateManager.load();
  const entry: ContinuityEntry = {
    remote_peer_id: 'remote@hub',
    local_anchor_id: 'anchor-1',
    conversation_id: null,
    last_inbound_turn: 0,
    last_outbound_turn: 0,
    created_at: '2026-03-24T10:00:00.000Z',
    updated_at: '2026-03-24T10:00:00.000Z',
  };
  stateManager.save(stateManager.setContinuity(state, ROUTE_KEY, entry));
};

const CONFIG = { localAgentId: AGENT_ID, localCulture: 'zh-CN' };
const REC_CONFIG = { agentId: AGENT_ID, apiKey: API_KEY, maxCatchupRetries: 2 };

// ---------------------------------------------------------------------------
// filterBeyondCursor
// ---------------------------------------------------------------------------

describe('filterBeyondCursor', () => {
  it('test_boundary_filter: discards items at or before cursor, keeps items after', () => {
    const messages: HubHistoryMessage[] = [
      makeHubMsg('aaa', '2026-03-24T12:00:00.000Z'),
      makeHubMsg('bbb', '2026-03-24T12:00:00.000Z'),
      makeHubMsg('ccc', '2026-03-24T12:00:00.000Z'),
      makeHubMsg('ddd', '2026-03-24T12:00:01.000Z'),
    ];

    const result = filterBeyondCursor(messages, '2026-03-24T12:00:00.000Z', 'bbb');

    expect(result).toHaveLength(2);
    expect(result[0].trace_id).toBe('ccc');
    expect(result[1].trace_id).toBe('ddd');
  });

  it('returns all messages when cursor is null (fresh start)', () => {
    const messages = [makeHubMsg('x', '2026-03-24T12:00:00.000Z')];
    const result = filterBeyondCursor(messages, null, null);
    expect(result).toHaveLength(1);
  });

  it('discards exact cursor match', () => {
    const messages = [makeHubMsg('exact', '2026-03-24T12:00:00.000Z')];
    const result = filterBeyondCursor(messages, '2026-03-24T12:00:00.000Z', 'exact');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RecoveryEngine
// ---------------------------------------------------------------------------

describe('RecoveryEngine', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // ---------------------------------------------------------------------------
  // test_resume_incomplete_delivery
  // ---------------------------------------------------------------------------

  it('test_resume_incomplete_delivery: incomplete inbound_fact → re-deliver via Hub history', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);

    // Seed: cursor already advanced past another route, but this fact is incomplete
    const completedFact: InboundFact = {
      route_key: 'local@hub:other@hub',
      observed_at: '2026-03-24T10:59:00.000Z',
      hub_timestamp: '2026-03-24T10:59:00.000Z',
      envelope_projection: makeProjection(),
      dedupe_result: 'new',
      delivery_evidence: { delivered_at: '2026-03-24T10:59:01.000Z', method: 'test', ref: null },
      terminal_disposition: null,
      cursor_advanced: true,
    };
    const incompleteFact: InboundFact = {
      route_key: ROUTE_KEY,
      observed_at: '2026-03-24T11:00:00.000Z',
      hub_timestamp: '2026-03-24T11:00:00.000Z',
      envelope_projection: makeProjection('Retry me'),
      dedupe_result: 'new',
      delivery_evidence: null,
      terminal_disposition: null,
      cursor_advanced: false,
    };

    const baseState = stateManager.load();
    const s1 = stateManager.setInboundFact(baseState, 'done-trace', completedFact);
    const s2 = stateManager.setInboundFact(s1, 'incomplete-trace', incompleteFact);
    const s3 = stateManager.advanceCursor(s2, 'done-trace', '2026-03-24T10:59:00.000Z');
    stateManager.save(s3);

    // Hub history returns the incomplete message with full envelope
    const hubMessages = [
      makeHubMsg('done-trace', '2026-03-24T10:59:00.000Z'),
      makeHubMsg('incomplete-trace', '2026-03-24T11:00:00.000Z', 'Retry me'),
    ];

    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient(hubMessages);
    const inbound = new InboundPipeline(stateManager, hostAdapter, CONFIG);
    const outbound = new OutboundPipeline(stateManager, CONFIG);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(stateManager, inbound, outbound, hubClient, hostAdapter, () => {});

    expect(hostAdapter.deliverInbound).toHaveBeenCalled();
    const finalState = stateManager.load();
    expect(finalState.inbound_facts['incomplete-trace'].cursor_advanced).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // test_advance_orphaned_cursor
  // ---------------------------------------------------------------------------

  it('test_advance_orphaned_cursor: delivery_evidence present but cursor not advanced → advance', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);

    const orphanedFact: InboundFact = {
      route_key: ROUTE_KEY,
      observed_at: '2026-03-24T11:00:00.000Z',
      hub_timestamp: '2026-03-24T11:00:00.000Z',
      envelope_projection: makeProjection(),
      dedupe_result: 'new',
      delivery_evidence: { delivered_at: '2026-03-24T11:00:01.000Z', method: 'test', ref: null },
      terminal_disposition: null,
      cursor_advanced: false,
    };
    stateManager.save(stateManager.setInboundFact(stateManager.load(), 'orphan-trace', orphanedFact));

    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient();
    const inbound = new InboundPipeline(stateManager, hostAdapter, CONFIG);
    const outbound = new OutboundPipeline(stateManager, CONFIG);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(stateManager, inbound, outbound, hubClient, hostAdapter, () => {});

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['orphan-trace'].cursor_advanced).toBe(true);
    expect(finalState.cursor.last_completed_trace_id).toBe('orphan-trace');
    expect(hostAdapter.deliverInbound).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // test_advance_orphaned_terminal_disposition
  // ---------------------------------------------------------------------------

  it('advances cursor when terminal_disposition set but cursor_advanced=false', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);

    const terminalFact: InboundFact = {
      route_key: ROUTE_KEY,
      observed_at: '2026-03-24T11:00:00.000Z',
      hub_timestamp: '2026-03-24T11:00:00.000Z',
      envelope_projection: makeProjection(),
      dedupe_result: 'new',
      delivery_evidence: null,
      terminal_disposition: { reason: 'delivery_failed_permanent', decided_at: '2026-03-24T11:00:01.000Z' },
      cursor_advanced: false,
    };
    stateManager.save(stateManager.setInboundFact(stateManager.load(), 'term-trace', terminalFact));

    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient();
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['term-trace'].cursor_advanced).toBe(true);
    expect(finalState.cursor.last_completed_trace_id).toBe('term-trace');
  });

  // ---------------------------------------------------------------------------
  // test_retry_unsubmitted_relay
  // ---------------------------------------------------------------------------

  it('test_retry_unsubmitted_relay: bound relay → submit with same idempotency_key', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);

    const relay: RelayRecord = {
      inbound_trace_id: null,
      route_key: ROUTE_KEY,
      reply_text: 'Pending reply',
      bound_turn_number: 1,
      idempotency_key: 'relay:local@hub:outbound-1',
      submitted_at: null,
      hub_trace_id: null,
      confirmed: false,
    };
    const baseState = stateManager.load();
    stateManager.save(stateManager.setRelayEvidence(baseState, 'outbound-1', relay));

    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient();
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    expect(hubClient.submitRelay).toHaveBeenCalled();
    const [, , , idempotencyKey] = (hubClient.submitRelay as jest.Mock).mock.calls[0];
    expect(idempotencyKey).toBe('relay:local@hub:outbound-1');

    const finalState = stateManager.load();
    expect(finalState.relay_evidence['outbound-1'].confirmed).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // test_relay_retry_failure_logged
  // ---------------------------------------------------------------------------

  it('logs error when relay retry fails but continues', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);

    const relay: RelayRecord = {
      inbound_trace_id: null,
      route_key: ROUTE_KEY,
      reply_text: 'Will fail',
      bound_turn_number: 1,
      idempotency_key: 'relay:local@hub:fail-1',
      submitted_at: null,
      hub_trace_id: null,
      confirmed: false,
    };
    stateManager.save(stateManager.setRelayEvidence(stateManager.load(), 'fail-1', relay));

    const errors: string[] = [];
    const hostAdapter = makeHostAdapter();
    const hubClient = {
      ...makeHubClient(),
      submitRelay: jest.fn().mockRejectedValue(new Error('hub down')),
    } as unknown as HubClient;
    const engine = new RecoveryEngine(REC_CONFIG, (msg) => errors.push(msg));

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    expect(errors.some((e) => e.includes('fail-1'))).toBe(true);
    // Relay remains unconfirmed
    const finalState = stateManager.load();
    expect(finalState.relay_evidence['fail-1'].confirmed).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // test_fresh_start
  // ---------------------------------------------------------------------------

  it('test_fresh_start: no state file → full catchup from Hub', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hubMessages = [makeHubMsg('fresh-1', '2026-03-24T12:00:00.000Z', 'First')];

    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient(hubMessages);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    expect(hubClient.fetchHistory).toHaveBeenCalledWith(API_KEY, undefined);
    const finalState = stateManager.load();
    expect(finalState.inbound_facts['fresh-1']).toBeDefined();
    expect(finalState.inbound_facts['fresh-1'].cursor_advanced).toBe(true);
    expect(hubClient.connectSSE).toHaveBeenCalled();
    expect(hostAdapter.acquireHandles).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // test_recovery_order
  // ---------------------------------------------------------------------------

  it('test_recovery_order: fetch history before live SSE connect, and live SSE connects before catchup processing', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const callOrder: string[] = [];
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockImplementation(async () => {
        callOrder.push('deliverInbound');
        return { status: 'confirmed', method: 'test', ref: 'history-ref', timestamp: new Date().toISOString() };
      }),
      acquireHandles: jest.fn().mockImplementation(async () => { callOrder.push('acquireHandles'); }),
    });
    const hubClient = {
      fetchHistory: jest.fn().mockImplementation(async () => {
        callOrder.push('fetchHistory');
        return [makeHubMsg('history-trace', '2026-03-24T12:00:00.000Z', 'History catchup')];
      }),
      submitRelay: jest.fn().mockResolvedValue({ trace_id: 't', delivery: 'd' }),
      connectSSE: jest.fn().mockImplementation(() => { callOrder.push('connectSSE'); }),
      disconnect: jest.fn(),
    } as unknown as HubClient;

    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    expect(callOrder.indexOf('fetchHistory')).toBeLessThan(callOrder.indexOf('connectSSE'));
    expect(callOrder.indexOf('acquireHandles')).toBeLessThan(callOrder.indexOf('connectSSE'));
    expect(callOrder.indexOf('connectSSE')).toBeLessThan(callOrder.indexOf('deliverInbound'));
    expect(stateManager.load().inbound_facts['history-trace'].cursor_advanced).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // test_catchup_retry_backoff
  // ---------------------------------------------------------------------------

  it('test_catchup_retry_backoff: retries Hub catchup with backoff then succeeds', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const errors: string[] = [];

    const hostAdapter = makeHostAdapter();
    const hubClient = {
      fetchHistory: jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce([]),
      submitRelay: jest.fn(),
      connectSSE: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as HubClient;

    // maxCatchupRetries=2 means 3 total attempts (0, 1, 2)
    const engine = new RecoveryEngine(
      { agentId: AGENT_ID, apiKey: API_KEY, maxCatchupRetries: 2 },
      (msg) => errors.push(msg),
    );

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    // fetchHistory called 3 times: 2 failures + 1 success
    expect(hubClient.fetchHistory).toHaveBeenCalledTimes(3);
    expect(errors).toHaveLength(2);
    // SSE connected after successful catchup
    expect(hubClient.connectSSE).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // test_catchup_exhausted_throws
  // ---------------------------------------------------------------------------

  it('test_catchup_exhausted_throws: throws after all retries exhausted, no SSE connect', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);

    const hostAdapter = makeHostAdapter();
    const hubClient = {
      fetchHistory: jest.fn().mockRejectedValue(new Error('hub down')),
      submitRelay: jest.fn(),
      connectSSE: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as HubClient;

    // maxCatchupRetries=1 means 2 total attempts
    const engine = new RecoveryEngine(
      { agentId: AGENT_ID, apiKey: API_KEY, maxCatchupRetries: 1 },
    );

    await expect(
      engine.recover(
        stateManager,
        new InboundPipeline(stateManager, hostAdapter, CONFIG),
        new OutboundPipeline(stateManager, CONFIG),
        hubClient, hostAdapter, () => {},
      ),
    ).rejects.toThrow('Hub catchup failed after 2 attempts');

    // SSE must NOT connect without successful catchup
    expect(hubClient.connectSSE).not.toHaveBeenCalled();
    expect(hostAdapter.acquireHandles).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // test_incomplete_not_in_history_logged
  // ---------------------------------------------------------------------------

  it('logs error when incomplete fact not found in Hub history', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);

    const incompleteFact: InboundFact = {
      route_key: ROUTE_KEY,
      observed_at: '2026-03-24T11:00:00.000Z',
      hub_timestamp: '2026-03-24T11:00:00.000Z',
      envelope_projection: makeProjection(),
      dedupe_result: 'new',
      delivery_evidence: null,
      terminal_disposition: null,
      cursor_advanced: false,
    };
    stateManager.save(stateManager.setInboundFact(stateManager.load(), 'missing-trace', incompleteFact));

    const errors: string[] = [];
    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient([]); // Empty history — trace not found
    const engine = new RecoveryEngine(REC_CONFIG, (msg) => errors.push(msg));

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    expect(errors.some((e) => e.includes('missing-trace') && e.includes('not found'))).toBe(true);
    // Fact remains incomplete
    expect(stateManager.load().inbound_facts['missing-trace'].cursor_advanced).toBe(false);
  });

  it('processes only history messages addressed to the local agent during catchup', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient([
      makeHubMsgFor('local-trace', '2026-03-24T12:00:00.000Z', {
        receiver_id: AGENT_ID,
        sender_id: 'remote@hub',
        envelope: {
          chorus_version: '0.4',
          sender_id: 'remote@hub',
          original_text: 'For local',
          sender_culture: 'en',
        } as any,
      }),
      makeHubMsgFor('other-trace', '2026-03-24T12:00:01.000Z', {
        receiver_id: 'other@hub',
        sender_id: 'remote@hub',
        envelope: {
          chorus_version: '0.4',
          sender_id: 'remote@hub',
          original_text: 'For somebody else',
          sender_culture: 'en',
        } as any,
      }),
    ]);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['local-trace']).toBeDefined();
    expect(finalState.inbound_facts['other-trace']).toBeUndefined();
    expect(hostAdapter.deliverInbound).toHaveBeenCalledTimes(1);
  });

  it('does not replay the current agent outbound history back into inbound on restart', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter();
    const hubClient = makeHubClient([
      makeHubMsgFor('self-outbound-trace', '2026-03-24T12:00:00.000Z', {
        receiver_id: 'remote@hub',
        sender_id: AGENT_ID,
        envelope: {
          chorus_version: '0.4',
          sender_id: AGENT_ID,
          original_text: 'Outbound from local agent',
          sender_culture: 'zh-CN',
        } as any,
      }),
    ]);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      new InboundPipeline(stateManager, hostAdapter, CONFIG),
      new OutboundPipeline(stateManager, CONFIG),
      hubClient, hostAdapter, () => {},
    );

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['self-outbound-trace']).toBeUndefined();
    expect(hostAdapter.deliverInbound).not.toHaveBeenCalled();
  });

  it('does not let an early live SSE event cause older catchup history to be skipped', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const hostAdapter = makeHostAdapter({
      deliverInbound: jest.fn().mockResolvedValue({
        status: 'confirmed',
        method: 'test',
        ref: 'ref-1',
        timestamp: '2026-03-24T12:05:01.000Z',
      } as DeliveryReceipt),
    });
    const liveProcessing: Promise<void>[] = [];
    const liveEvent: HubSSEEvent = {
      trace_id: 'live-trace',
      sender_id: 'live@hub',
      envelope: {
        chorus_version: '0.4',
        sender_id: 'live@hub',
        original_text: 'Live first',
        sender_culture: 'en',
      } as any,
      hub_timestamp: '2026-03-24T12:05:00.000Z',
    };
    const hubClient = {
      fetchHistory: jest.fn().mockResolvedValue([
        makeHubMsgFor('history-trace', '2026-03-24T12:00:00.000Z', {
          receiver_id: AGENT_ID,
          sender_id: 'history@hub',
          envelope: {
            chorus_version: '0.4',
            sender_id: 'history@hub',
            original_text: 'Older backlog',
            sender_culture: 'en',
          } as any,
        }),
      ]),
      submitRelay: jest.fn().mockResolvedValue({ trace_id: 'hub-t-1', delivery: 'delivered' }),
      connectSSE: jest.fn().mockImplementation((
        _agentId: string,
        _apiKey: string,
        onEvent: SSECallback,
      ) => {
        liveProcessing.push(Promise.resolve().then(() => onEvent(liveEvent)));
      }),
      disconnect: jest.fn(),
    } as unknown as HubClient;
    const inbound = new InboundPipeline(stateManager, hostAdapter, CONFIG);
    const outbound = new OutboundPipeline(stateManager, CONFIG);
    const engine = new RecoveryEngine(REC_CONFIG);

    await engine.recover(
      stateManager,
      inbound,
      outbound,
      hubClient,
      hostAdapter,
      (event) => {
        liveProcessing.push(inbound.processMessage(event));
      },
    );
    await Promise.all(liveProcessing);

    const finalState = stateManager.load();
    expect(finalState.inbound_facts['history-trace']).toBeDefined();
    expect(finalState.inbound_facts['live-trace']).toBeDefined();
    expect(finalState.cursor.last_completed_trace_id).toBe('live-trace');
    expect(finalState.cursor.last_completed_timestamp).toBe('2026-03-24T12:05:00.000Z');
  });
});
