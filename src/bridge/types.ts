// Author: be-domain-modeler

/**
 * ISO8601 timestamp string alias for documentation clarity.
 */
export type ISO8601 = string;

/**
 * Delivery evidence recorded when host confirms message visibility.
 */
export interface DeliveryEvidence {
  readonly delivered_at: ISO8601;
  readonly method: string;
  readonly ref: string | null;
}

/**
 * Terminal disposition when a message will not be delivered normally.
 */
export interface TerminalDisposition {
  readonly reason: 'duplicate' | 'delivery_failed_permanent' | 'delivery_unverifiable';
  readonly decided_at: ISO8601;
}

/**
 * Records every inbound message's journey through the pipeline.
 * Field transitions are monotonic: null -> value, false -> true.
 */
export interface InboundFact {
  readonly route_key: string;
  readonly observed_at: ISO8601;
  readonly hub_timestamp: ISO8601;
  readonly dedupe_result: 'new' | 'duplicate' | null;
  readonly delivery_evidence: DeliveryEvidence | null;
  readonly terminal_disposition: TerminalDisposition | null;
  readonly cursor_advanced: boolean;
}

/**
 * One entry per route. Binds a remote peer to a local conversation anchor.
 */
export interface ContinuityEntry {
  readonly remote_peer_id: string;
  readonly local_anchor_id: string;
  readonly conversation_id: string | null;
  readonly last_inbound_turn: number;
  readonly last_outbound_turn: number;
  readonly created_at: ISO8601;
  readonly updated_at: ISO8601;
}

/**
 * Records each outbound relay attempt.
 * Only reply_text, bound_turn_number, and idempotency_key are non-derivable.
 */
export interface RelayRecord {
  readonly inbound_trace_id: string | null;
  readonly route_key: string;
  readonly reply_text: string;
  readonly bound_turn_number: number;
  readonly idempotency_key: string;
  readonly submitted_at: ISO8601 | null;
  readonly hub_trace_id: string | null;
  readonly confirmed: boolean;
}

/**
 * Cursor tracks the most recent fully-processed inbound message.
 */
export interface Cursor {
  readonly last_completed_trace_id: string | null;
  readonly last_completed_timestamp: ISO8601 | null;
}

/**
 * The single durable state schema for Bridge v2.
 * One per agent. One authority. No satellite files.
 */
export interface BridgeDurableState {
  readonly schema_version: '2.0';
  readonly agent_id: string;
  readonly cursor: Cursor;
  readonly continuity: { readonly [route_key: string]: ContinuityEntry };
  readonly inbound_facts: { readonly [trace_id: string]: InboundFact };
  readonly relay_evidence: { readonly [outbound_id: string]: RelayRecord };
}

/**
 * Receipt returned by Host Adapter after delivery attempt.
 */
export interface DeliveryReceipt {
  readonly status: 'confirmed' | 'unverifiable' | 'failed';
  readonly method: string;
  readonly ref: string | null;
  readonly timestamp: ISO8601;
}

/**
 * Host Adapter interface — each host runtime implements this contract.
 * Bridge calls these methods; it does not define how they work internally.
 */
export interface HostAdapter {
  adaptContent(params: {
    readonly original_text: string;
    readonly sender_culture: string;
    readonly receiver_culture: string;
    readonly cultural_context: string | null;
  }): Promise<string>;

  deliverInbound(params: {
    readonly route_key: string;
    readonly local_anchor_id: string;
    readonly adapted_content: string;
    readonly metadata: {
      readonly sender_id: string;
      readonly sender_culture: string;
      readonly cultural_context: string | null;
      readonly conversation_id: string | null;
      readonly turn_number: number;
      readonly trace_id: string;
    };
  }): Promise<DeliveryReceipt>;

  onReplyDetected(callback: (params: {
    readonly route_key: string;
    readonly reply_text: string;
    readonly inbound_trace_id: string | null;
  }) => void): void;

  resolveLocalAnchor(route_key: string): Promise<string>;

  acquireHandles(): Promise<void>;
  releaseHandles(): Promise<void>;
}
