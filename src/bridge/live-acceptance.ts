// Author: be-domain-modeler
import type { BridgeDurableState, DeliveryEvidence, TerminalDisposition } from './types';

export interface LiveAcceptanceStateEvidence {
  readonly inboundTraceId: string;
  readonly routeKey: string;
  readonly cursorAdvanced: boolean;
  readonly deliveryEvidence: DeliveryEvidence | null;
  readonly terminalDisposition: TerminalDisposition | null;
  readonly relayRecordId: string | null;
  readonly relayTraceId: string | null;
  readonly relayConfirmed: boolean;
}

export interface LiveAcceptanceLogEvidence {
  readonly deliveryLogFound: boolean;
  readonly deliveryMethod: string | null;
  readonly relayLogFound: boolean;
}

interface DeliveryLogPayload {
  readonly trace_id?: string;
  readonly route_key?: string;
  readonly method?: string;
}

const BRIDGE_DELIVERY_MARKER = '[bridge:delivery] ';
const RELAY_OK_MARKER = 'outbound relay OK: ';

export const extractStateEvidence = (
  state: BridgeDurableState,
  inboundTraceId: string,
): LiveAcceptanceStateEvidence | null => {
  const inboundFact = state.inbound_facts[inboundTraceId];
  if (!inboundFact) {
    return null;
  }

  const routeKey = inboundFact.route_key;

  const relayMatch = Object.entries(state.relay_evidence)
    .filter(([, r]) => r.inbound_trace_id === inboundTraceId && r.route_key === routeKey)
    .reduce<{ relayRecordId: string | null; relayTraceId: string | null; relayConfirmed: boolean }>(
      (best, [recordId, record]) => {
        if (record.confirmed) {
          return { relayRecordId: recordId, relayTraceId: record.hub_trace_id, relayConfirmed: true };
        }
        if (best.relayRecordId === null) {
          return { relayRecordId: recordId, relayTraceId: record.hub_trace_id, relayConfirmed: false };
        }
        return best;
      },
      { relayRecordId: null, relayTraceId: null, relayConfirmed: false },
    );

  const { relayRecordId, relayTraceId, relayConfirmed } = relayMatch;

  return {
    inboundTraceId,
    routeKey,
    cursorAdvanced: inboundFact.cursor_advanced,
    deliveryEvidence: inboundFact.delivery_evidence,
    terminalDisposition: inboundFact.terminal_disposition,
    relayRecordId,
    relayTraceId,
    relayConfirmed,
  };
};

export const extractLogEvidence = (
  logText: string,
  inboundTraceId: string,
  routeKey: string,
  relayTraceId: string | null,
): LiveAcceptanceLogEvidence => {
  const lines = logText.split(/\r?\n/);

  const deliveryLine = lines.find((line) => {
    if (!line.includes(BRIDGE_DELIVERY_MARKER)) return false;
    const payload = parseDeliveryPayload(line);
    return payload !== null && payload.trace_id === inboundTraceId && payload.route_key === routeKey;
  });

  const deliveryLogFound = deliveryLine !== undefined;
  const deliveryMethod = deliveryLogFound
    ? (parseDeliveryPayload(deliveryLine!)?.method ?? null)
    : null;

  const relayLogFound = relayTraceId !== null && lines.some((line) => {
    if (!line.includes(RELAY_OK_MARKER)) return false;
    const m = line.match(/outbound relay OK: trace_id=(\S+) route_key=(\S+)/);
    return m !== null && m[1] === relayTraceId && m[2] === routeKey;
  });

  return {
    deliveryLogFound,
    deliveryMethod,
    relayLogFound,
  };
};

const parseDeliveryPayload = (line: string): DeliveryLogPayload | null => {
  const markerIndex = line.indexOf(BRIDGE_DELIVERY_MARKER);
  if (markerIndex < 0) {
    return null;
  }

  const jsonStart = line.indexOf('{', markerIndex);
  if (jsonStart < 0) {
    return null;
  }

  try {
    return JSON.parse(line.slice(jsonStart)) as DeliveryLogPayload;
  } catch {
    return null;
  }
};
