<!-- Author: Lead -->

# ADR-B2-003: Host Adapter Must Confirm Delivery Before Bridge Records Evidence

## Background (Context)

Bridge v1 conflated transport-level success with local delivery:

- Hub emitting an SSE event was logged as "delivered_sse"
- Bridge calling the host delivery API was treated as delivery success
- No distinction between "API call returned" and "user can see the message"

The freeze defines local delivery as: "a remote Chorus turn has been turned into a host-visible local turn, and Bridge has recorded evidence of that fact in durable bridge state." Transport acceptance alone is explicitly forbidden as delivery evidence.

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| A: Host Adapter returns DeliveryReceipt with confirmation | Bridge knows delivery succeeded; cursor advance is safe | Requires host to support confirmed delivery |
| B: Bridge assumes delivery succeeded after API call (fire-and-forget) | Simpler; no callback needed | Violates freeze; cursor may advance before user sees message |
| C: Bridge polls host for delivery status | No callback needed; eventual confirmation | Complex; adds polling loop; latency |

## Decision

**Option A: Host Adapter returns DeliveryReceipt.**

### Reasons

1. **Freeze requirement**: cursor advance requires delivery evidence; fire-and-forget (Option B) is explicitly forbidden
2. **Simplicity**: synchronous return value (DeliveryReceipt) is simpler than polling (Option C)
3. **Host responsibility**: the host runtime is the only authority on whether a message is user-visible; Bridge should not guess

### What if a host cannot confirm delivery?

If a host runtime genuinely cannot confirm delivery (pure fire-and-forget channel), the Host Adapter implementation has two honest options:

1. **Record `terminal_disposition = "delivery_unverifiable"`**: admits the gap; cursor advances with the disposition as evidence
2. **Block until confirmation is possible**: wait for a confirmation signal (e.g., message read receipt)

Option 1 is preferred for MVP: it satisfies the freeze (terminal disposition is stored evidence) while being honest about the delivery gap. The product can then decide whether "unverifiable" delivery is acceptable for that host.

## Consequences

- **Positive**: Delivery evidence is real — cursor advance is safe
- **Positive**: Host Adapter implementors have a clear contract to fulfill
- **Negative**: Hosts that only support fire-and-forget must choose between blocking or honest degradation
- **Rejected**: Option B violates freeze; Option C adds unnecessary complexity
