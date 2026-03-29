// Author: be-domain-modeler
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OutboundPipeline } from '../../src/bridge/outbound';
import { DurableStateManager } from '../../src/bridge/state';
import type { ContinuityEntry, BridgeDurableState } from '../../src/bridge/types';
import type { HubClient, RelayResult } from '../../src/bridge/hub-client';

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'outbound-test-'));

const AGENT_ID = 'local@hub';
const CONFIG = { localAgentId: AGENT_ID, localCulture: 'zh-CN' };
const ROUTE_KEY = 'local@hub:remote@hub';

const seedContinuity = (
  stateManager: DurableStateManager,
  overrides: Partial<ContinuityEntry> = {},
): void => {
  const state = stateManager.load();
  const entry: ContinuityEntry = {
    remote_peer_id: 'remote@hub',
    local_anchor_id: 'anchor-1',
    conversation_id: 'conv-abc',
    last_inbound_turn: 1,
    last_outbound_turn: 2,
    created_at: '2026-03-24T10:00:00.000Z',
    updated_at: '2026-03-24T10:00:00.000Z',
    ...overrides,
  };
  const updated = stateManager.setContinuity(state, ROUTE_KEY, entry);
  stateManager.save(updated);
};

const mockHubClient = (result: RelayResult = { trace_id: 'hub-t-1', delivery: 'delivered_sse' }): HubClient => ({
  submitRelay: jest.fn().mockResolvedValue(result),
  fetchHistory: jest.fn().mockResolvedValue([]),
  disconnect: jest.fn(),
} as unknown as HubClient);

// ---------------------------------------------------------------------------
// test_bind_persists_before_submit
// ---------------------------------------------------------------------------

describe('OutboundPipeline', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('test_bind_persists_before_submit: relay_evidence written with reply_text before any HTTP call', () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'My reply', 'inbound-t1');

    const state = stateManager.load();
    const record = state.relay_evidence[outboundId];

    expect(record).toBeDefined();
    expect(record.reply_text).toBe('My reply');
    expect(record.inbound_trace_id).toBe('inbound-t1');
    expect(record.submitted_at).toBeNull();
    expect(record.hub_trace_id).toBeNull();
    expect(record.confirmed).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // test_envelope_reconstruction
  // ---------------------------------------------------------------------------

  it('test_envelope_reconstruction: outbound envelope matches fields from continuity + config', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const hub = mockHubClient();

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply text', null);
    await pipeline.submitRelay(outboundId, hub, 'api-key');

    const [, receiverId, envelope] = (hub.submitRelay as jest.Mock).mock.calls[0];
    expect(receiverId).toBe('remote@hub');
    expect(envelope.sender_id).toBe('local@hub');
    expect(envelope.original_text).toBe('Reply text');
    expect(envelope.sender_culture).toBe('zh-CN');
    expect(envelope.turn_number).toBe(3); // last_outbound_turn=2, bound=3
    expect(envelope.conversation_id).toBe('conv-abc');
    expect(envelope.chorus_version).toBe('0.4');
  });

  // ---------------------------------------------------------------------------
  // test_idempotency_key_immutable
  // ---------------------------------------------------------------------------

  it('test_idempotency_key_immutable: same outbound_id always uses same idempotency_key', () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);

    const state1 = stateManager.load();
    const key1 = state1.relay_evidence[outboundId].idempotency_key;

    // Re-read — same key
    const state2 = stateManager.load();
    const key2 = state2.relay_evidence[outboundId].idempotency_key;

    expect(key1).toBe(key2);
    expect(key1).toContain('relay:');
  });

  // ---------------------------------------------------------------------------
  // test_null_conversation_id
  // ---------------------------------------------------------------------------

  it('test_null_conversation_id: conversation_id omitted from envelope when null', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager, { conversation_id: null });
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const hub = mockHubClient();

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);
    await pipeline.submitRelay(outboundId, hub, 'api-key');

    const [, , envelope] = (hub.submitRelay as jest.Mock).mock.calls[0];
    expect(envelope.conversation_id).toBeUndefined();
    expect('conversation_id' in envelope).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // test_turn_increment
  // ---------------------------------------------------------------------------

  it('test_turn_increment: last_outbound_turn incremented only on confirmation', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const hub = mockHubClient();

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);

    // Before submit: turn unchanged
    const statePreSubmit = stateManager.load();
    expect(statePreSubmit.continuity[ROUTE_KEY].last_outbound_turn).toBe(2);

    // After submit: still unchanged
    await pipeline.submitRelay(outboundId, hub, 'api-key');
    const statePostSubmit = stateManager.load();
    expect(statePostSubmit.continuity[ROUTE_KEY].last_outbound_turn).toBe(2);

    // After confirm: incremented
    await pipeline.confirmRelay(outboundId, 'hub-t-1');
    const statePostConfirm = stateManager.load();
    expect(statePostConfirm.continuity[ROUTE_KEY].last_outbound_turn).toBe(3);

    // relay_evidence marked confirmed
    expect(statePostConfirm.relay_evidence[outboundId].confirmed).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Input validation: empty reply_text rejected
  // ---------------------------------------------------------------------------

  it('rejects empty reply_text', () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    expect(() => pipeline.bindReply(ROUTE_KEY, '', null)).toThrow('non-empty');
    expect(() => pipeline.bindReply(ROUTE_KEY, '   ', null)).toThrow('non-empty');
  });

  // ---------------------------------------------------------------------------
  // Submission failure leaves relay retryable
  // ---------------------------------------------------------------------------

  it('hub submission failure keeps submitted_at=null (retry-safe)', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const hub = {
      submitRelay: jest.fn().mockRejectedValue(new Error('network error')),
    } as unknown as HubClient;

    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);

    await expect(pipeline.submitRelay(outboundId, hub, 'key')).rejects.toThrow('network error');

    const state = stateManager.load();
    const record = state.relay_evidence[outboundId];
    expect(record.submitted_at).toBeNull();
    expect(record.hub_trace_id).toBeNull();
    expect(record.confirmed).toBe(false);
  });

  it('rejects bindReply when continuity is missing', () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    expect(() => pipeline.bindReply(ROUTE_KEY, 'Reply', null)).toThrow(`No continuity entry for route_key="${ROUTE_KEY}"`);
  });

  it('rejects submitRelay when relay evidence is missing', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    await expect(
      pipeline.submitRelay('missing-outbound', mockHubClient(), 'api-key'),
    ).rejects.toThrow('No relay_evidence');
  });

  it('rejects submitRelay when continuity disappears before submission', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);

    const state = stateManager.load();
    const withoutContinuity: BridgeDurableState = {
      ...state,
      continuity: {},
    };
    stateManager.save(withoutContinuity);

    await expect(
      pipeline.submitRelay(outboundId, mockHubClient(), 'api-key'),
    ).rejects.toThrow(`No continuity for route_key="${ROUTE_KEY}"`);
  });

  it('rejects confirmRelay when relay evidence is missing', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);

    await expect(
      pipeline.confirmRelay('missing-outbound', 'hub-trace'),
    ).rejects.toThrow('No relay_evidence');
  });

  it('rejects confirmRelay when continuity disappears before confirmation', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    const outboundId = pipeline.bindReply(ROUTE_KEY, 'Reply', null);

    const state = stateManager.load();
    stateManager.save({
      ...state,
      continuity: {},
    });

    await expect(
      pipeline.confirmRelay(outboundId, 'hub-trace'),
    ).rejects.toThrow(`No continuity for route_key="${ROUTE_KEY}"`);
  });

  it('relayReply serializes same-route replies so bound_turn_number stays unique and ordered', async () => {
    const stateManager = new DurableStateManager(tmpDir, AGENT_ID);
    seedContinuity(stateManager);
    const pipeline = new OutboundPipeline(stateManager, CONFIG);
    let submitCount = 0;
    const hub = {
      submitRelay: jest.fn().mockImplementation(async (
        _apiKey: string,
        _receiverId: string,
        _envelope: Record<string, unknown>,
      ) => {
        submitCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { trace_id: `hub-t-${submitCount}`, delivery: 'delivered_sse' };
      }),
      fetchHistory: jest.fn().mockResolvedValue([]),
      disconnect: jest.fn(),
    } as unknown as HubClient;

    await Promise.all([
      pipeline.relayReply(ROUTE_KEY, 'Reply one', 'in-1', hub, 'api-key'),
      pipeline.relayReply(ROUTE_KEY, 'Reply two', 'in-2', hub, 'api-key'),
    ]);

    const firstEnvelope = (hub.submitRelay as jest.Mock).mock.calls[0][2];
    const secondEnvelope = (hub.submitRelay as jest.Mock).mock.calls[1][2];
    expect(firstEnvelope.turn_number).toBe(3);
    expect(secondEnvelope.turn_number).toBe(4);

    const state = stateManager.load();
    const boundTurns = Object.values(state.relay_evidence)
      .map((record) => record.bound_turn_number)
      .sort((a, b) => a - b);
    expect(boundTurns).toEqual([3, 4]);
    expect(state.continuity[ROUTE_KEY].last_outbound_turn).toBe(4);
  });
});
