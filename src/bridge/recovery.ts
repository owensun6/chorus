// Author: be-domain-modeler
import { DurableStateManager } from './state';
import { computeBackoff } from './hub-client';
import type {
  BridgeDurableState,
  InboundFact,
  HostAdapter,
} from './types';
import type { InboundPipeline } from './inbound';
import type { OutboundPipeline } from './outbound';
import type { HubClient, HubSSEEvent, HubHistoryMessage, SSECallback } from './hub-client';

export interface RecoveryConfig {
  readonly agentId: string;
  readonly apiKey: string;
  readonly maxCatchupRetries: number;
}

const DEFAULT_MAX_RETRIES = 5;

/**
 * Compare two (timestamp, trace_id) tuples in total order.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
const compareCursorPosition = (
  aTimestamp: string, aTraceId: string,
  bTimestamp: string, bTraceId: string,
): number => {
  if (aTimestamp < bTimestamp) return -1;
  if (aTimestamp > bTimestamp) return 1;
  if (aTraceId < bTraceId) return -1;
  if (aTraceId > bTraceId) return 1;
  return 0;
};

/**
 * Filter Hub history messages, discarding items at or before cursor position.
 * Uses composite (timestamp, trace_id) total-order comparison.
 */
export const filterBeyondCursor = (
  messages: readonly HubHistoryMessage[],
  cursorTimestamp: string | null,
  cursorTraceId: string | null,
): readonly HubHistoryMessage[] => {
  if (cursorTimestamp === null || cursorTraceId === null) {
    return messages;
  }
  return messages.filter((msg) =>
    compareCursorPosition(msg.timestamp, msg.trace_id, cursorTimestamp, cursorTraceId) > 0,
  );
};

/**
 * Convert a HubHistoryMessage to a HubSSEEvent for pipeline processing.
 */
const historyToSSEEvent = (msg: HubHistoryMessage): HubSSEEvent => ({
  trace_id: msg.trace_id,
  sender_id: msg.sender_id,
  envelope: msg.envelope,
  hub_timestamp: msg.timestamp,
});

/**
 * Sleep for a given number of milliseconds.
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recovery engine — startup scan + Hub catchup + SSE resume.
 *
 * Sequence from System_Design.md §5:
 * 1. Load state
 * 2. Advance orphaned cursors
 * 3. Fetch Hub history (with retry+backoff) — needed for step 4
 * 4. Resume incomplete inbound facts from last completed step
 * 5. Retry incomplete relays
 * 6. Process new Hub messages through inbound pipeline
 * 7. Connect SSE
 * 8. Acquire host handles
 */
export class RecoveryEngine {
  private readonly config: RecoveryConfig;
  private readonly onError: (msg: string) => void;

  constructor(
    config: RecoveryConfig & { maxCatchupRetries?: number },
    onError: (msg: string) => void = () => {},
  ) {
    this.config = {
      ...config,
      maxCatchupRetries: config.maxCatchupRetries ?? DEFAULT_MAX_RETRIES,
    };
    this.onError = onError;
  }

  /**
   * Execute full recovery sequence.
   * Returns the post-recovery state for verification.
   */
  async recover(
    stateManager: DurableStateManager,
    inboundPipeline: InboundPipeline,
    outboundPipeline: OutboundPipeline,
    hubClient: HubClient,
    hostAdapter: HostAdapter,
    onSSEEvent: SSECallback,
  ): Promise<BridgeDurableState> {
    // Step 1: Load durable state
    const state = stateManager.load();

    // Step 2: Advance orphaned cursors
    await this.advanceOrphanedCursors(state, stateManager);

    // Step 3: Fetch Hub history with retry+backoff (required before SSE)
    const stateAfterCursors = stateManager.load();
    const history = await this.fetchHistoryWithRetry(hubClient, stateAfterCursors);

    // Step 4: Resume incomplete inbound facts using Hub history envelopes
    await this.resumeIncompleteInbound(stateManager, inboundPipeline, history);

    // Step 5: Retry incomplete relays
    await this.retryRelays(stateManager, outboundPipeline, hubClient);

    // Step 6: Process new Hub messages (beyond cursor) through pipeline
    await this.processNewMessages(stateManager, inboundPipeline, history);

    // Step 7: Connect SSE (only after catchup succeeds)
    hubClient.connectSSE(
      this.config.agentId,
      this.config.apiKey,
      onSSEEvent,
      this.onError,
    );

    // Step 8: Acquire host handles
    await hostAdapter.acquireHandles();

    return stateManager.load();
  }

  /**
   * Step 2: Advance cursors for facts that have evidence but cursor_advanced=false.
   * Uses mutate() to serialize state writes.
   */
  private async advanceOrphanedCursors(
    state: BridgeDurableState,
    stateManager: DurableStateManager,
  ): Promise<void> {
    for (const [traceId, fact] of Object.entries(state.inbound_facts)) {
      if (fact.cursor_advanced) continue;

      if (fact.delivery_evidence !== null || fact.terminal_disposition !== null) {
        await stateManager.mutate((currentState) => {
          const updatedFact: InboundFact = { ...fact, cursor_advanced: true };
          const s1 = stateManager.setInboundFact(currentState, traceId, updatedFact);
          return stateManager.advanceCursor(s1, traceId, fact.hub_timestamp);
        });
      }
    }
  }

  /**
   * Step 3: Fetch Hub history with exponential backoff retry.
   * MUST succeed before SSE can connect — fail-closed if all retries exhausted.
   */
  private async fetchHistoryWithRetry(
    hubClient: HubClient,
    state: BridgeDurableState,
  ): Promise<readonly HubHistoryMessage[]> {
    const sinceTimestamp = state.cursor.last_completed_timestamp ?? undefined;

    for (let attempt = 0; attempt <= this.config.maxCatchupRetries; attempt++) {
      try {
        return await hubClient.fetchHistory(this.config.apiKey, sinceTimestamp);
      } catch (err) {
        this.onError(`Recovery: Hub catchup attempt ${attempt + 1} failed: ${String(err)}`);
        if (attempt < this.config.maxCatchupRetries) {
          await delay(computeBackoff(attempt));
        }
      }
    }

    throw new Error(
      `Recovery: Hub catchup failed after ${this.config.maxCatchupRetries + 1} attempts — cannot proceed to SSE`,
    );
  }

  /**
   * Step 4: Resume incomplete inbound facts from their last completed step.
   * Uses Hub history to supply the original envelope for re-delivery.
   */
  private async resumeIncompleteInbound(
    stateManager: DurableStateManager,
    inboundPipeline: InboundPipeline,
    history: readonly HubHistoryMessage[],
  ): Promise<void> {
    const state = stateManager.load();
    const localHistory = history.filter((msg) => msg.receiver_id === this.config.agentId);
    const historyIndex = new Map(localHistory.map((msg) => [msg.trace_id, msg]));

    for (const [traceId, fact] of Object.entries(state.inbound_facts)) {
      if (fact.cursor_advanced) continue;
      if (fact.delivery_evidence !== null || fact.terminal_disposition !== null) continue;

      // This fact needs re-delivery. Find its envelope from Hub history.
      const hubMsg = historyIndex.get(traceId);
      if (!hubMsg) {
        this.onError(`Recovery: incomplete fact ${traceId} not found in Hub history — skipping`);
        continue;
      }

      try {
        await inboundPipeline.processMessage(historyToSSEEvent(hubMsg));
      } catch (err) {
        this.onError(`Recovery: failed to resume inbound ${traceId}: ${String(err)}`);
      }
    }
  }

  /**
   * Step 5: Retry incomplete relays (bound-not-submitted or submitted-not-confirmed).
   */
  private async retryRelays(
    stateManager: DurableStateManager,
    outboundPipeline: OutboundPipeline,
    hubClient: HubClient,
  ): Promise<void> {
    const state = stateManager.load();

    for (const [outboundId, record] of Object.entries(state.relay_evidence)) {
      if (record.confirmed) continue;

      try {
        const result = await outboundPipeline.submitRelay(
          outboundId, hubClient, this.config.apiKey,
        );
        await outboundPipeline.confirmRelay(outboundId, result.trace_id);
      } catch (err) {
        this.onError(`Recovery: failed to retry relay ${outboundId}: ${String(err)}`);
      }
    }
  }

  /**
   * Step 6: Process new messages from Hub history (beyond current cursor).
   */
  private async processNewMessages(
    stateManager: DurableStateManager,
    inboundPipeline: InboundPipeline,
    history: readonly HubHistoryMessage[],
  ): Promise<void> {
    const state = stateManager.load();
    const { last_completed_timestamp, last_completed_trace_id } = state.cursor;

    const newMessages = filterBeyondCursor(
      history,
      last_completed_timestamp,
      last_completed_trace_id,
    ).filter((msg) => msg.receiver_id === this.config.agentId);

    for (const msg of newMessages) {
      // Skip messages already in inbound_facts (handled in step 4)
      if (state.inbound_facts[msg.trace_id]) continue;

      try {
        await inboundPipeline.processMessage(historyToSSEEvent(msg));
      } catch (err) {
        this.onError(`Recovery: failed to process catchup message ${msg.trace_id}: ${String(err)}`);
      }
    }
  }
}
