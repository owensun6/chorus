// Author: be-ai-integrator
import {
  OpenClawAdapter,
} from '../../../src/bridge/adapters/openclaw';
import type {
  ChannelDispatch,
  ChannelResult,
  AdaptFn,
  DeliveryMetadata,
} from '../../../src/bridge/adapters/openclaw';

const makeAdaptFn = (result: string = 'Adapted text'): AdaptFn =>
  jest.fn().mockResolvedValue(result);

const makeChannel = (overrides: Partial<ChannelDispatch> = {}): ChannelDispatch => ({
  name: 'test-channel',
  send: jest.fn().mockResolvedValue({ delivered: true, ref: 'msg-123' } as ChannelResult),
  ...overrides,
});

const AGENT_ID = 'local@hub';
const ROUTE_KEY = 'local@hub:remote@hub';

const makeDeliveryParams = (overrides: Partial<{ route_key: string; local_anchor_id: string; adapted_content: string; metadata: DeliveryMetadata }> = {}) => ({
  route_key: ROUTE_KEY,
  local_anchor_id: 'anchor-1',
  adapted_content: 'Hello in English',
  metadata: {
    sender_id: 'remote@hub',
    sender_culture: 'zh-CN',
    cultural_context: null,
    conversation_id: null,
    turn_number: 1,
    trace_id: 'trace-001',
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// test_adapt_content
// ---------------------------------------------------------------------------

describe('OpenClawAdapter.adaptContent', () => {
  it('test_adapt_content: cultural adaptation produces non-empty adapted text', async () => {
    const adaptFn = makeAdaptFn('Hello, how are you?');
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn,
      channel: makeChannel(),
    });

    const result = await adapter.adaptContent({
      original_text: '你好，最近怎么样？',
      sender_culture: 'zh-CN',
      receiver_culture: 'en',
      cultural_context: null,
    });

    expect(result).toBe('Hello, how are you?');
    expect(result.length).toBeGreaterThan(0);
    expect(adaptFn).toHaveBeenCalledWith({
      original_text: '你好，最近怎么样？',
      sender_culture: 'zh-CN',
      receiver_culture: 'en',
      cultural_context: null,
    });
  });

  it('passes cultural_context when provided', async () => {
    const adaptFn = makeAdaptFn('Adapted with context');
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn,
      channel: makeChannel(),
    });

    await adapter.adaptContent({
      original_text: 'Test',
      sender_culture: 'zh-CN',
      receiver_culture: 'en',
      cultural_context: 'This is a formal greeting in Chinese business culture',
    });

    const callArgs = (adaptFn as jest.Mock).mock.calls[0][0];
    expect(callArgs.cultural_context).toBe('This is a formal greeting in Chinese business culture');
  });
});

// ---------------------------------------------------------------------------
// test_delivery_confirmed
// ---------------------------------------------------------------------------

describe('OpenClawAdapter.deliverInbound', () => {
  it('test_delivery_confirmed: confirmed channel → status="confirmed" with method + ref', async () => {
    const channel = makeChannel({
      name: 'weixin',
      send: jest.fn().mockResolvedValue({ delivered: true, ref: 'wx-msg-456' }),
    });
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel,
    });

    const receipt = await adapter.deliverInbound(makeDeliveryParams());

    expect(receipt.status).toBe('confirmed');
    expect(receipt.method).toBe('weixin');
    expect(receipt.ref).toBe('wx-msg-456');
    expect(receipt.timestamp).toBeDefined();
    expect(new Date(receipt.timestamp).toISOString()).toBe(receipt.timestamp);
  });

  // ---------------------------------------------------------------------------
  // test_delivery_unverifiable
  // ---------------------------------------------------------------------------

  it('test_delivery_unverifiable: fire-and-forget channel → status="unverifiable"', async () => {
    const channel = makeChannel({
      name: 'telegram',
      send: jest.fn().mockResolvedValue({ delivered: true, ref: null }),
    });
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel,
    });

    const receipt = await adapter.deliverInbound(makeDeliveryParams());

    expect(receipt.status).toBe('unverifiable');
    expect(receipt.method).toBe('telegram');
    expect(receipt.ref).toBeNull();
  });

  it('returns status="failed" when channel reports not delivered', async () => {
    const channel = makeChannel({
      name: 'weixin',
      send: jest.fn().mockResolvedValue({ delivered: false, ref: null }),
    });
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel,
    });

    const receipt = await adapter.deliverInbound(makeDeliveryParams());

    expect(receipt.status).toBe('failed');
    expect(receipt.method).toBe('weixin');
  });

  it('throws on transient channel failure (pipeline catches, fact stays retryable)', async () => {
    const channel = makeChannel({
      send: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel,
    });

    await expect(adapter.deliverInbound(makeDeliveryParams())).rejects.toThrow('transient');
  });
});

// ---------------------------------------------------------------------------
// test_reply_attribution
// ---------------------------------------------------------------------------

describe('OpenClawAdapter.onReplyDetected + emitReply', () => {
  it('test_reply_attribution: callback receives correct route_key and inbound_trace_id', async () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    const received: Array<{ route_key: string; reply_text: string; inbound_trace_id: string | null }> = [];
    adapter.onReplyDetected((params) => { received.push(params); });

    // Deliver inbound first (sets active trace)
    await adapter.deliverInbound(makeDeliveryParams({
      metadata: { sender_id: 'remote@hub', sender_culture: 'zh-CN', cultural_context: null, conversation_id: null, turn_number: 1, trace_id: 'trace-inbound-1' },
    }));

    // Host generates reply
    adapter.emitReply(ROUTE_KEY, 'This is my reply');

    expect(received).toHaveLength(1);
    expect(received[0].route_key).toBe(ROUTE_KEY);
    expect(received[0].reply_text).toBe('This is my reply');
    expect(received[0].inbound_trace_id).toBe('trace-inbound-1');
  });

  it('provides null inbound_trace_id when no prior delivery for route', () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    const received: Array<{ inbound_trace_id: string | null }> = [];
    adapter.onReplyDetected((params) => { received.push(params); });

    // Emit reply without prior delivery
    adapter.emitReply(ROUTE_KEY, 'Unsolicited reply');

    expect(received[0].inbound_trace_id).toBeNull();
  });

  it('does not throw when no callback registered', () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    expect(() => adapter.emitReply(ROUTE_KEY, 'reply')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveLocalAnchor
// ---------------------------------------------------------------------------

describe('OpenClawAdapter.resolveLocalAnchor', () => {
  it('returns route_key as session anchor', async () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    const anchor = await adapter.resolveLocalAnchor(ROUTE_KEY);
    expect(anchor).toBe(ROUTE_KEY);
  });

  it('rejects invalid route_key format', async () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    await expect(adapter.resolveLocalAnchor('invalid-no-colon')).rejects.toThrow('Invalid route_key');
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('OpenClawAdapter lifecycle', () => {
  it('releaseHandles clears state', async () => {
    const adapter = new OpenClawAdapter({
      agentId: AGENT_ID,
      receiverCulture: 'en',
      adaptFn: makeAdaptFn(),
      channel: makeChannel(),
    });

    const received: string[] = [];
    adapter.onReplyDetected((params) => { received.push(params.reply_text); });

    await adapter.deliverInbound(makeDeliveryParams());
    await adapter.releaseHandles();

    // Callback cleared — emitReply should not fire
    adapter.emitReply(ROUTE_KEY, 'after release');
    expect(received).toHaveLength(0);
  });
});
