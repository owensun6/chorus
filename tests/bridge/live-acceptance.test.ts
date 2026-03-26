// Author: codex
import { extractLogEvidence, extractStateEvidence } from '../../src/bridge/live-acceptance';
import type { BridgeDurableState } from '../../src/bridge/types';

const makeState = (): BridgeDurableState => ({
  schema_version: '2.0',
  agent_id: 'xiaoyin@chorus',
  cursor: {
    last_completed_trace_id: 'inbound-trace',
    last_completed_timestamp: '2026-03-26T12:00:56.034Z',
  },
  continuity: {
    'xiaoyin@chorus:probe@chorus': {
      remote_peer_id: 'probe@chorus',
      local_anchor_id: 'agent:xiaoyin:main',
      conversation_id: null,
      last_inbound_turn: 1,
      last_outbound_turn: 1,
      created_at: '2026-03-26T12:00:56.176Z',
      updated_at: '2026-03-26T12:01:08.803Z',
    },
  },
  inbound_facts: {
    'inbound-trace': {
      route_key: 'xiaoyin@chorus:probe@chorus',
      observed_at: '2026-03-26T12:00:56.175Z',
      hub_timestamp: '2026-03-26T12:00:56.034Z',
      envelope_projection: {
        original_text: 'probe',
        sender_culture: 'en',
        cultural_context: null,
        conversation_id: null,
        turn_number: 1,
      },
      dedupe_result: 'new',
      delivery_evidence: null,
      terminal_disposition: {
        reason: 'delivery_unverifiable',
        decided_at: '2026-03-26T12:01:07.736Z',
      },
      cursor_advanced: true,
    },
  },
  relay_evidence: {
    relay_1: {
      inbound_trace_id: 'inbound-trace',
      route_key: 'xiaoyin@chorus:probe@chorus',
      reply_text: 'ack',
      bound_turn_number: 1,
      idempotency_key: 'relay-key',
      submitted_at: '2026-03-26T12:01:08.801Z',
      hub_trace_id: 'relay-trace',
      confirmed: true,
    },
  },
});

describe('bridge live acceptance evidence', () => {
  it('extractStateEvidence binds inbound trace to confirmed relay evidence', () => {
    const evidence = extractStateEvidence(makeState(), 'inbound-trace');

    expect(evidence).not.toBeNull();
    expect(evidence!.routeKey).toBe('xiaoyin@chorus:probe@chorus');
    expect(evidence!.cursorAdvanced).toBe(true);
    expect(evidence!.terminalDisposition?.reason).toBe('delivery_unverifiable');
    expect(evidence!.relayTraceId).toBe('relay-trace');
    expect(evidence!.relayConfirmed).toBe(true);
  });

  it('extractStateEvidence rejects confirmed relay evidence on a mismatched route', () => {
    const state = makeState();
    const mismatch = {
      ...state,
      relay_evidence: {
        relay_wrong_route: {
          ...state.relay_evidence.relay_1,
          route_key: 'xiaoyin@chorus:other@chorus',
        },
      },
    };

    const evidence = extractStateEvidence(mismatch, 'inbound-trace');

    expect(evidence).not.toBeNull();
    expect(evidence!.routeKey).toBe('xiaoyin@chorus:probe@chorus');
    expect(evidence!.relayRecordId).toBeNull();
    expect(evidence!.relayTraceId).toBeNull();
    expect(evidence!.relayConfirmed).toBe(false);
  });

  it('extractLogEvidence requires both delivery trace and outbound relay for the same route', () => {
    const logText = [
      '2026-03-26T20:01:07.732+08:00 [gateway] [chorus-bridge] [bridge:delivery] {"event":"delivery_unverifiable","trace_id":"inbound-trace","route_key":"xiaoyin@chorus:probe@chorus","method":"telegram_api_accepted","terminal_disposition":"delivery_unverifiable","timestamp":"2026-03-26T12:01:07.736Z"}',
      '2026-03-26T20:01:08.811+08:00 [gateway] [chorus-bridge] outbound relay OK: trace_id=relay-trace route_key=xiaoyin@chorus:probe@chorus',
    ].join('\n');

    const evidence = extractLogEvidence(
      logText,
      'inbound-trace',
      'xiaoyin@chorus:probe@chorus',
      'relay-trace',
    );

    expect(evidence.deliveryLogFound).toBe(true);
    expect(evidence.deliveryMethod).toBe('telegram_api_accepted');
    expect(evidence.relayLogFound).toBe(true);
  });

  it('extractLogEvidence rejects mismatched relay trace ids', () => {
    const logText = [
      '[bridge:delivery] {"trace_id":"inbound-trace","route_key":"xiaoyin@chorus:probe@chorus","method":"telegram_api_accepted"}',
      'outbound relay OK: trace_id=other-relay route_key=xiaoyin@chorus:probe@chorus',
    ].join('\n');

    const evidence = extractLogEvidence(
      logText,
      'inbound-trace',
      'xiaoyin@chorus:probe@chorus',
      'relay-trace',
    );

    expect(evidence.deliveryLogFound).toBe(true);
    expect(evidence.relayLogFound).toBe(false);
  });
});
