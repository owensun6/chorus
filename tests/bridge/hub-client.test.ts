// Author: be-domain-modeler
import {
  parseSSEEvent,
  parseHistoryResponse,
  computeBackoff,
  HubClient,
  HubClientError,
} from '../../src/bridge/hub-client';

const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = fetchMock;
const trackedClients: HubClient[] = [];
const makeClient = (hubUrl: string, config?: ConstructorParameters<typeof HubClient>[1]): HubClient => {
  const client = new HubClient(hubUrl, config);
  trackedClients.push(client);
  return client;
};

afterAll(() => {
  global.fetch = originalFetch;
});

afterEach(() => {
  for (const client of trackedClients.splice(0)) {
    client.disconnect();
  }
  fetchMock.mockClear();
});

// ---------------------------------------------------------------------------
// test_sse_parse_timestamp
// ---------------------------------------------------------------------------

describe('parseSSEEvent', () => {
  const errors: string[] = [];
  const onError = (msg: string) => { errors.push(msg); };

  beforeEach(() => { errors.length = 0; });

  it('test_sse_parse_timestamp: extracts hub_timestamp from timestamp field', () => {
    const raw = JSON.stringify({
      trace_id: 't-1',
      sender_id: 'alice@hub',
      envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
      timestamp: '2026-03-24T12:00:00.000Z',
    });

    const event = parseSSEEvent(raw, onError);

    expect(event).not.toBeNull();
    expect(event!.hub_timestamp).toBe('2026-03-24T12:00:00.000Z');
    expect(event!.trace_id).toBe('t-1');
    expect(event!.sender_id).toBe('alice@hub');
    expect(event!.envelope.original_text).toBe('hi');
    expect(errors).toHaveLength(0);
  });

  it('test_sse_missing_timestamp: discards event when timestamp missing', () => {
    const raw = JSON.stringify({
      trace_id: 't-2',
      sender_id: 'alice@hub',
      envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
      // no timestamp
    });

    const event = parseSSEEvent(raw, onError);

    expect(event).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('timestamp');
  });

  it('discards event when trace_id missing', () => {
    const raw = JSON.stringify({
      sender_id: 'alice@hub',
      envelope: {},
      timestamp: '2026-03-24T12:00:00.000Z',
    });

    const event = parseSSEEvent(raw, onError);

    expect(event).toBeNull();
    expect(errors[0]).toContain('trace_id');
  });

  it('discards event when JSON is invalid', () => {
    const event = parseSSEEvent('not-json', onError);

    expect(event).toBeNull();
    expect(errors[0]).toContain('not valid JSON');
  });

  it('returns frozen object', () => {
    const raw = JSON.stringify({
      trace_id: 't-3',
      sender_id: 'alice@hub',
      envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
      timestamp: '2026-03-24T12:00:00.000Z',
    });

    const event = parseSSEEvent(raw, onError);

    expect(Object.isFrozen(event)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// test_history_inclusive
// ---------------------------------------------------------------------------

describe('parseHistoryResponse', () => {
  it('test_history_inclusive: preserves all messages without filtering', () => {
    const data = [
      { trace_id: 't-1', sender_id: 'a@h', receiver_id: 'b@h', envelope: {}, delivered_via: 'sse', timestamp: '2026-03-24T12:00:00.000Z' },
      { trace_id: 't-2', sender_id: 'a@h', receiver_id: 'b@h', envelope: {}, delivered_via: 'queued', timestamp: '2026-03-24T12:00:01.000Z' },
    ];

    const result = parseHistoryResponse(data as any);

    expect(result).toHaveLength(2);
    expect(result[0].trace_id).toBe('t-1');
    expect(result[1].trace_id).toBe('t-2');
  });

  it('test_malformed_history_throws: malformed item throws HubClientError (fail-closed)', () => {
    const data = [{ invalid: 'structure', no_trace_id: true }];
    expect(() => parseHistoryResponse(data)).toThrow(HubClientError);
  });
});

// ---------------------------------------------------------------------------
// test_backoff
// ---------------------------------------------------------------------------

describe('computeBackoff', () => {
  it('test_backoff: follows exponential pattern with 30s cap', () => {
    expect(computeBackoff(0)).toBe(1000);
    expect(computeBackoff(1)).toBe(2000);
    expect(computeBackoff(2)).toBe(4000);
    expect(computeBackoff(3)).toBe(8000);
    expect(computeBackoff(4)).toBe(16000);
    expect(computeBackoff(5)).toBe(30000); // capped
    expect(computeBackoff(10)).toBe(30000); // still capped
  });
});

// ---------------------------------------------------------------------------
// test_relay_idempotency_header
// ---------------------------------------------------------------------------

describe('HubClient.submitRelay', () => {
  it('test_relay_idempotency_header: includes Idempotency-Key header in POST', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: { trace_id: 'hub-trace-1', delivery: 'delivered_sse' },
      }), { status: 200 }),
    );

    const envelope = {
      chorus_version: '0.4' as const,
      sender_id: 'local@hub',
      original_text: 'reply text',
      sender_culture: 'en',
    };

    await client.submitRelay('api-key-123', 'remote@hub', envelope, 'KEY-RELAY-001');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hub.example.com/messages');
    expect(opts?.method).toBe('POST');

    const headers = opts?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('KEY-RELAY-001');
    expect(headers['Authorization']).toBe('Bearer api-key-123');
  });

  it('throws HubClientError on non-2xx response', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    const envelope = {
      chorus_version: '0.4' as const,
      sender_id: 'local@hub',
      original_text: 'reply',
      sender_culture: 'en',
    };

    await expect(
      client.submitRelay('key', 'remote@hub', envelope, 'KEY-2'),
    ).rejects.toThrow(HubClientError);
  });

  it('test_malformed_relay_throws: malformed relay response throws HubClientError (fail-closed)', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { wrong_field: 'x' } }), { status: 200 }),
    );

    const envelope = {
      chorus_version: '0.4' as const,
      sender_id: 'local@hub',
      original_text: 'relay',
      sender_culture: 'en',
    };

    await expect(
      client.submitRelay('key', 'remote@hub', envelope, 'KEY-3'),
    ).rejects.toThrow(HubClientError);
  });
});

// ---------------------------------------------------------------------------
// HubClient.fetchHistory
// ---------------------------------------------------------------------------

describe('HubClient.fetchHistory', () => {
  it('sends since param as query string', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );

    await client.fetchHistory('api-key', '2026-03-24T12:00:00.000Z');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('since=2026-03-24T12%3A00%3A00.000Z');
  });

  it('throws HubClientError on failure', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(
      client.fetchHistory('bad-key'),
    ).rejects.toThrow(HubClientError);
  });

  it('test_fetchHistory_timeout: throws on hung Hub', async () => {
    fetchMock.mockImplementationOnce((...args: Parameters<typeof fetch>) => {
      const init = args[1];
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });

    const timeoutClient = makeClient('https://hub.example.com', { fetchTimeoutMs: 100 });

    await expect(
      timeoutClient.fetchHistory('api-key'),
    ).rejects.toThrow('timed out');
  }, 5000);
});

// ---------------------------------------------------------------------------
// HubClient.submitRelay timeout
// ---------------------------------------------------------------------------

describe('HubClient.submitRelay timeout', () => {
  it('test_submitRelay_timeout: throws on hung Hub, relay stays retryable', async () => {
    fetchMock.mockImplementationOnce((...args: Parameters<typeof fetch>) => {
      const init = args[1];
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });

    const timeoutClient = makeClient('https://hub.example.com', { relayTimeoutMs: 100 });
    const envelope = {
      chorus_version: '0.4' as const,
      sender_id: 'local@hub',
      original_text: 'relay',
      sender_culture: 'en',
    };

    await expect(
      timeoutClient.submitRelay('key', 'remote@hub', envelope, 'KEY-TIMEOUT'),
    ).rejects.toThrow('timed out');
  }, 5000);
});

// ---------------------------------------------------------------------------
// HubClient.connectSSE + disconnect
// ---------------------------------------------------------------------------

const makeSSEStream = (frames: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(frames));
      controller.close();
    },
  });
};

describe('HubClient.connectSSE', () => {
  it('test_connectSSE_delivers_valid_events: parses message events and calls onEvent', async () => {
    const ssePayload =
      `event: connected\ndata: {"agent_id":"a@h"}\n\n` +
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-1',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
        timestamp: '2026-03-24T12:00:00.000Z',
      })}\n\n`;

    fetchMock.mockResolvedValueOnce(
      new Response(makeSSEStream(ssePayload), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const client = makeClient('https://hub.example.com');
    const received: Array<{ trace_id: string; hub_timestamp: string }> = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push({ trace_id: event.trace_id, hub_timestamp: event.hub_timestamp });
    });

    // Wait for stream consumption
    await new Promise((r) => setTimeout(r, 50));
    client.disconnect();

    expect(received).toHaveLength(1);
    expect(received[0].trace_id).toBe('t-1');
    expect(received[0].hub_timestamp).toBe('2026-03-24T12:00:00.000Z');
  });

  it('test_connectSSE_discards_invalid_events: missing timestamp logs error, SSE continues', async () => {
    const ssePayload =
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-bad',
        sender_id: 'alice@hub',
        envelope: {},
        // no timestamp
      })}\n\n` +
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-good',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'ok', sender_culture: 'en' },
        timestamp: '2026-03-24T13:00:00.000Z',
      })}\n\n`;

    fetchMock.mockResolvedValueOnce(
      new Response(makeSSEStream(ssePayload), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const client = makeClient('https://hub.example.com');
    const received: string[] = [];
    const errors: string[] = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push(event.trace_id);
    }, (msg) => { errors.push(msg); });

    await new Promise((r) => setTimeout(r, 50));
    client.disconnect();

    // Invalid event discarded, valid one received
    expect(received).toEqual(['t-good']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('timestamp');
  });

  it('test_disconnect_stops_reconnection: disconnect prevents further fetch calls', async () => {
    // First fetch fails → triggers reconnect
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const client = makeClient('https://hub.example.com');
    client.connectSSE('agent-a', 'key-1', () => {});

    // Wait briefly, then disconnect before reconnect timer fires
    await new Promise((r) => setTimeout(r, 50));
    client.disconnect();

    const callsBefore = fetchMock.mock.calls.length;

    // Wait longer than backoff(0)=1s to confirm no reconnect
    await new Promise((r) => setTimeout(r, 1200));

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('test_connectSSE_url_format: uses token query param for SSE', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(makeSSEStream(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const client = makeClient('https://hub.example.com');
    client.connectSSE('agent-a', 'my-api-key', () => {});

    await new Promise((r) => setTimeout(r, 20));
    client.disconnect();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/agent/inbox');
    expect(url).toContain('token=my-api-key');
  });
});
