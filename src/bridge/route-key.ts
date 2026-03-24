// Author: be-domain-modeler

/**
 * Compute a route key from local agent ID and remote peer ID.
 *
 * Format: "{local_agent_id}:{remote_peer_id}"
 *
 * Properties:
 * - Deterministic: same inputs always produce same key
 * - Direction-aware: swapping arguments produces a different key
 * - Restart-safe: both components are persistent identifiers
 */
export const computeRouteKey = (
  localAgentId: string,
  remotePeerId: string
): string => `${localAgentId}:${remotePeerId}`;
