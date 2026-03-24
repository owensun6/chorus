// Author: be-ai-integrator
import type {
  HostAdapter,
  DeliveryReceipt,
  ISO8601,
} from '../types';

/**
 * Channel dispatch interface — each channel provides send + confirmation semantics.
 */
export interface ChannelDispatch {
  readonly name: string;
  send(localAnchorId: string, content: string, metadata: DeliveryMetadata): Promise<ChannelResult>;
}

export interface DeliveryMetadata {
  readonly sender_id: string;
  readonly sender_culture: string;
  readonly cultural_context: string | null;
  readonly conversation_id: string | null;
  readonly turn_number: number;
  readonly trace_id: string;
}

export interface ChannelResult {
  readonly delivered: boolean;
  readonly ref: string | null;
}

/**
 * Content adaptation function — wraps LLM call for cultural adaptation.
 */
export type AdaptFn = (params: {
  readonly original_text: string;
  readonly sender_culture: string;
  readonly receiver_culture: string;
  readonly cultural_context: string | null;
}) => Promise<string>;

/**
 * Reply callback registered via onReplyDetected.
 */
type ReplyCallback = (params: {
  readonly route_key: string;
  readonly reply_text: string;
  readonly inbound_trace_id: string | null;
}) => void;

export interface OpenClawAdapterConfig {
  readonly agentId: string;
  readonly receiverCulture: string;
  readonly adaptFn: AdaptFn;
  readonly channel: ChannelDispatch;
}

const ROUTE_KEY_FORMAT = /^[^:]+:[^:]+$/;

/**
 * OpenClaw Host Adapter — implements HostAdapter for the OpenClaw runtime.
 *
 * - adaptContent: delegates to injected AdaptFn (LLM-based cultural adaptation)
 * - deliverInbound: dispatches via injected ChannelDispatch; returns honest receipt
 *   per T-08 findings (confirmed if channel ACKs, unverifiable for fire-and-forget)
 * - onReplyDetected: stores callback, invoked by host reply pipeline via emitReply()
 * - resolveLocalAnchor: returns route_key as session anchor (OpenClaw sessions are route-keyed)
 *
 * Does NOT store Hub API keys or manage Bridge pipeline logic.
 */
export class OpenClawAdapter implements HostAdapter {
  private readonly config: OpenClawAdapterConfig;
  private replyCallback: ReplyCallback | null = null;
  private activeTraces = new Map<string, string>(); // route_key → trace_id

  constructor(config: OpenClawAdapterConfig) {
    this.config = config;
  }

  async adaptContent(params: {
    readonly original_text: string;
    readonly sender_culture: string;
    readonly receiver_culture: string;
    readonly cultural_context: string | null;
  }): Promise<string> {
    return this.config.adaptFn(params);
  }

  async deliverInbound(params: {
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
  }): Promise<DeliveryReceipt> {
    const now = new Date().toISOString();

    // Track active trace for reply attribution
    this.activeTraces.set(params.route_key, params.metadata.trace_id);

    try {
      const result = await this.config.channel.send(
        params.local_anchor_id,
        params.adapted_content,
        params.metadata,
      );

      if (!result.delivered) {
        return { status: 'failed', method: this.config.channel.name, ref: null, timestamp: now };
      }

      // Per T-08 findings: channel result determines confirmed vs unverifiable
      // If ref is non-null, channel provided a server-side receipt → confirmed
      // If ref is null, channel is fire-and-forget → unverifiable
      const status = result.ref !== null ? 'confirmed' : 'unverifiable';
      return { status, method: this.config.channel.name, ref: result.ref, timestamp: now };
    } catch {
      // Transient failure: throw so pipeline leaves fact retryable
      throw new Error(`Channel ${this.config.channel.name} delivery failed (transient)`);
    }
  }

  onReplyDetected(callback: ReplyCallback): void {
    this.replyCallback = callback;
  }

  /**
   * Called by host reply pipeline when a reply is generated.
   * Binds by route_key, NOT by reply text parsing.
   */
  emitReply(routeKey: string, replyText: string): void {
    if (!this.replyCallback) return;

    const inboundTraceId = this.activeTraces.get(routeKey) ?? null;
    this.replyCallback({
      route_key: routeKey,
      reply_text: replyText,
      inbound_trace_id: inboundTraceId,
    });
  }

  async resolveLocalAnchor(routeKey: string): Promise<string> {
    if (!ROUTE_KEY_FORMAT.test(routeKey)) {
      throw new Error(`Invalid route_key format: "${routeKey}"`);
    }
    // OpenClaw sessions are keyed by route_key itself
    return routeKey;
  }

  async acquireHandles(): Promise<void> {
    // Lifecycle hook — channel connections are managed externally
  }

  async releaseHandles(): Promise<void> {
    this.activeTraces.clear();
    this.replyCallback = null;
  }
}
