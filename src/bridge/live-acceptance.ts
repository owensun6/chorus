// Author: codex
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

  let relayRecordId: string | null = null;
  let relayTraceId: string | null = null;
  let relayConfirmed = false;
  const routeKey = inboundFact.route_key;

  for (const [recordId, record] of Object.entries(state.relay_evidence)) {
    if (record.inbound_trace_id !== inboundTraceId) {
      continue;
    }

    if (record.route_key !== routeKey) {
      continue;
    }

    if (record.confirmed) {
      relayRecordId = recordId;
      relayTraceId = record.hub_trace_id;
      relayConfirmed = true;
      break;
    }

    if (relayRecordId === null) {
      relayRecordId = recordId;
      relayTraceId = record.hub_trace_id;
    }
  }

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
  let deliveryLogFound = false;
  let deliveryMethod: string | null = null;
  let relayLogFound = false;

  for (const line of logText.split(/\r?\n/)) {
    if (!deliveryLogFound && line.includes(BRIDGE_DELIVERY_MARKER)) {
      const payload = parseDeliveryPayload(line);
      if (payload && payload.trace_id === inboundTraceId && payload.route_key === routeKey) {
        deliveryLogFound = true;
        deliveryMethod = payload.method ?? null;
      }
    }

    if (!relayLogFound && relayTraceId && line.includes(RELAY_OK_MARKER)) {
      const relayMatch = line.match(/outbound relay OK: trace_id=(\S+) route_key=(\S+)/);
      if (relayMatch && relayMatch[1] === relayTraceId && relayMatch[2] === routeKey) {
        relayLogFound = true;
      }
    }

    if (deliveryLogFound && (relayLogFound || relayTraceId === null)) {
      break;
    }
  }

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
