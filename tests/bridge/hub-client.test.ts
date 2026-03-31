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
const flushMicrotasks = async (turns: number = 6): Promise<void> => {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve();
  }
};

afterAll(() => {
  global.fetch = originalFetch;
});

afterEach(async () => {
  for (const client of trackedClients.splice(0)) {
    client.disconnect();
  }
  await flushMicrotasks();
  jest.clearAllTimers();
  jest.useRealTimers();
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

  it('rethrows non-timeout fetch failures', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      client.fetchHistory('api-key'),
    ).rejects.toThrow('network down');
  });

  it('throws HubClientError when history wrapper is malformed', async () => {
    const client = makeClient('https://hub.example.com');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, data: [] }), { status: 200 }),
    );

    await expect(
      client.fetchHistory('api-key'),
    ).rejects.toThrow(HubClientError);
  });
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

/** Mock both session exchange (POST /agent/session) and SSE connect (GET /agent/inbox?session=...) */
const mockSessionAndSSE = (ssePayload: string, sessionToken: string = 'cs_test_session'): void => {
  // First call: POST /agent/session
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, data: { session_token: sessionToken, expires_in_seconds: 300 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  // Second call: GET /agent/inbox?session=...
  fetchMock.mockResolvedValueOnce(
    new Response(makeSSEStream(ssePayload), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  );
};

describe('HubClient.connectSSE', () => {
  it('test_connectSSE_delivers_valid_events: parses message events and calls onEvent', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    const ssePayload =
      `event: connected\ndata: {"agent_id":"a@h"}\n\n` +
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-1',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
        timestamp: '2026-03-24T12:00:00.000Z',
      })}\n\n`;

    mockSessionAndSSE(ssePayload);

    const client = makeClient('https://hub.example.com');
    const received: Array<{ trace_id: string; hub_timestamp: string }> = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push({ trace_id: event.trace_id, hub_timestamp: event.hub_timestamp });
    });

    await flushMicrotasks();
    client.disconnect();
    await flushMicrotasks();

    expect(received).toHaveLength(1);
    expect(received[0].trace_id).toBe('t-1');
    expect(received[0].hub_timestamp).toBe('2026-03-24T12:00:00.000Z');
  });

  it('test_connectSSE_discards_invalid_events: missing timestamp logs error, SSE continues', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
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

    mockSessionAndSSE(ssePayload);

    const client = makeClient('https://hub.example.com');
    const received: string[] = [];
    const errors: string[] = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push(event.trace_id);
    }, (msg) => { errors.push(msg); });

    await flushMicrotasks();
    client.disconnect();
    await flushMicrotasks();

    // Invalid event discarded, valid one received
    expect(received).toEqual(['t-good']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('timestamp');
  });

  it('skips SSE blocks without data lines or message event types', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    const ssePayload =
      `event: message\n\n` +
      `data: ${JSON.stringify({
        trace_id: 'missing-event-line',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'skip', sender_culture: 'en' },
        timestamp: '2026-03-24T13:00:00.000Z',
      })}\n\n` +
      `event: ping\ndata: ${JSON.stringify({
        trace_id: 'ping-event',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'skip', sender_culture: 'en' },
        timestamp: '2026-03-24T13:00:01.000Z',
      })}\n\n` +
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-good',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'ok', sender_culture: 'en' },
        timestamp: '2026-03-24T13:00:02.000Z',
      })}\n\n`;

    mockSessionAndSSE(ssePayload);

    const client = makeClient('https://hub.example.com');
    const received: string[] = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push(event.trace_id);
    });

    await flushMicrotasks();
    client.disconnect();
    await flushMicrotasks();

    expect(received).toEqual(['t-good']);
  });

  it('retries after SSE HTTP failure', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    // Attempt 1: session OK, SSE fails
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { session_token: 'cs_1', expires_in_seconds: 300 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    // Attempt 2: session OK, SSE OK
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { session_token: 'cs_2', expires_in_seconds: 300 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(makeSSEStream(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));

    const client = makeClient('https://hub.example.com');
    const errors: string[] = [];

    client.connectSSE('agent-a', 'key-1', () => {}, (msg) => { errors.push(msg); });

    await flushMicrotasks(20);
    expect(fetchMock).toHaveBeenCalledTimes(2); // session + SSE (503)
    expect(errors.length).toBeGreaterThan(0);

    await jest.advanceTimersByTimeAsync(2000);
    await flushMicrotasks(20);
    expect(fetchMock).toHaveBeenCalledTimes(4); // retry: session + SSE
    client.disconnect();
    await flushMicrotasks();
  });

  it('does not reconnect when the stream ends after an explicit disconnect', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    const ssePayload =
      `event: message\ndata: ${JSON.stringify({
        trace_id: 't-1',
        sender_id: 'alice@hub',
        envelope: { chorus_version: '0.4', sender_id: 'alice@hub', original_text: 'hi', sender_culture: 'en' },
        timestamp: '2026-03-24T12:00:00.000Z',
      })}\n\n`;

    mockSessionAndSSE(ssePayload);

    const client = makeClient('https://hub.example.com');
    let disconnected = false;

    client.connectSSE('agent-a', 'key-1', () => {
      if (!disconnected) {
        disconnected = true;
        client.disconnect();
      }
    });

    await flushMicrotasks(10);

    const callsAfterDisconnect = fetchMock.mock.calls.length;
    await jest.advanceTimersByTimeAsync(10000);
    await flushMicrotasks(10);

    // After disconnect, no additional fetch calls should happen (no reconnect)
    expect(fetchMock.mock.calls.length).toBe(callsAfterDisconnect);
  });

  it('suppresses reconnect and error logging on intentional abort', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    // Session exchange succeeds, SSE hangs until abort
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { session_token: 'cs_abort', expires_in_seconds: 300 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    fetchMock.mockImplementationOnce((...args: Parameters<typeof fetch>) => {
      const init = args[1];
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const client = makeClient('https://hub.example.com');
    const errors: string[] = [];
    client.connectSSE('agent-a', 'key-1', () => {}, (msg) => { errors.push(msg); });

    await flushMicrotasks();
    client.disconnect();
    await Promise.resolve();
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();

    expect(errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // session + aborted SSE
  });

  it('test_disconnect_stops_reconnection: disconnect prevents further fetch calls', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    // Session exchange fails → triggers reconnect
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const client = makeClient('https://hub.example.com');
    client.connectSSE('agent-a', 'key-1', () => {});

    await flushMicrotasks();
    client.disconnect();

    const callsBefore = fetchMock.mock.calls.length;

    await jest.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('test_sse_buffer_overflow: oversized frame without delimiters triggers onError and terminates', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    const oversizedPayload = 'data: ' + 'x'.repeat(65_000); // >64KB, no \n\n delimiter

    const encoder = new TextEncoder();
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(oversizedPayload));
        controller.close();
      },
    });

    // Mock session exchange
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { session_token: 'cs_overflow', expires_in_seconds: 300 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // Mock SSE response with oversized payload
    fetchMock.mockResolvedValueOnce(
      new Response(oversizedStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const client = makeClient('https://hub.example.com');
    const errors: string[] = [];
    const received: string[] = [];

    client.connectSSE('agent-a', 'key-1', (event) => {
      received.push(event.trace_id);
    }, (msg) => { errors.push(msg); });

    await flushMicrotasks(10);
    client.disconnect();
    await flushMicrotasks();

    expect(received).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.includes('exceeds'))).toBe(true);
  });

  it('test_connectSSE_url_format: uses session handshake (not api key in URL)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate', 'performance'] });
    mockSessionAndSSE('', 'cs_my_session_token');

    const client = makeClient('https://hub.example.com');
    client.connectSSE('agent-a', 'my-api-key', () => {});

    await flushMicrotasks();
    client.disconnect();
    await flushMicrotasks();

    // First call: POST /agent/session with API key in Authorization header
    const [sessionUrl, sessionOpts] = fetchMock.mock.calls[0];
    expect(sessionUrl).toContain('/agent/session');
    expect((sessionOpts as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: 'Bearer my-api-key' }));

    // Second call: GET /agent/inbox?session=... (no API key in URL)
    const [sseUrl] = fetchMock.mock.calls[1];
    expect(sseUrl).toContain('/agent/inbox?session=cs_my_session_token');
    expect(sseUrl).not.toContain('token=');
    expect(sseUrl).not.toContain('my-api-key');
  });
});
