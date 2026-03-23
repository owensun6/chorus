<!-- Author: Lead -->

# ADR-B2-002: Route Key = `{local_agent_id}:{remote_peer_id}`

## Background (Context)

Bridge v1 used `active-peer.json` to track which remote peer was "currently active." This file was reconstructed from `history/*.jsonl` on startup — meaning the relay target was derived from transcript files. The freeze explicitly forbids this: "relay binding must come from durable bridge state, not transcript guesswork."

We need a deterministic key that uniquely identifies the conversation route between a local agent and a remote peer, survives restart, and does not depend on message content or session state.

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| A: `{local_agent_id}:{remote_peer_id}` | Deterministic, restart-safe, transcript-independent | One route per peer (no multi-conversation with same peer) |
| B: Hub-assigned `conversation_id` | Supports multiple conversations per peer pair | Depends on Hub-assigned value; unavailable before first message |
| C: `{channel}:{session_id}` | Matches host session model | Channel-specific; violates freeze ("Bridge may not start from a single channel definition") |

## Decision

**Option A: `{local_agent_id}:{remote_peer_id}`**

### Reasons

1. **Deterministic**: Both components exist in agent config before any message arrives
2. **Restart-safe**: Neither component is runtime-ephemeral
3. **Freeze-compliant**: Does not depend on transcripts, prompt residue, or channel identity
4. **Sufficient for current usage**: Chorus conversations are 1:1 between agent pairs; multi-conversation per pair is not a current requirement

### Multi-conversation future

If Chorus later needs multiple concurrent conversations between the same agent pair, the key would change to `{local_agent_id}:{remote_peer_id}:{conversation_id}`. This is NOT additive — route_key is the primary key of `continuity`, a classifier in `inbound_facts` and `relay_evidence`, and a parameter in the Host Adapter contract. Changing it requires a schema migration and Host Adapter contract update. The cost is bounded (rekey existing entries, update adapter implementations) but real.

The decision to start with the simpler key follows FP step 2 (delete complexity that isn't needed yet). If multi-conversation becomes a requirement, it enters as a new Phase with its own migration plan.

## Consequences

- **Positive**: Key is computable without any Hub interaction or message content
- **Positive**: One route per peer simplifies continuity management
- **Negative**: Cannot have multiple simultaneous conversations with the same peer (acceptable; not a current requirement)
- **Rejected**: Option B requires Hub interaction before key exists; Option C violates channel-independence
