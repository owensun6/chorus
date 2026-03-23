<!-- Author: Lead -->

# ADR-B2-001: Single Durable State Schema Per Agent

## Background (Context)

Bridge v1 stored bridge-managed truth across five independent files per agent:

- `cursor.json` — read position from Hub
- `seen.json` — deduplication set (trace_ids)
- `inbox/*.json` — pending unprocessed messages
- `history/*.jsonl` — conversation log per peer
- `active-peer.json` — last active peer binding

These files had no declared parent schema, no ordering rule between them, and no atomic update guarantee. When Bridge crashed mid-processing, the relationship between cursor position, delivery status, and peer binding was ambiguous. Recovery required reading transcript files and reconstructing state — exactly what the freeze forbids.

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| A: Single JSON file per agent | Atomic writes (temp+rename), single truth source, simple recovery | Entire state rewritten on each mutation; file grows with history |
| B: SQLite per agent | ACID transactions, efficient queries, built-in WAL | Additional dependency; more complex than needed for per-agent state |
| C: Multiple files with ordering manifest | Keeps v1 file structure, adds a manifest for ordering | Still multiple authorities; manifest itself becomes a truth source to maintain |

## Decision

**Option A: Single JSON file per agent.**

### Reasons

1. **Freeze mandate**: "all bridge-managed dedupe, cursor position, continuity binding, and local-delivery evidence live here under one schema" — a single file is the simplest physical expression of this requirement
2. **Atomic writes**: write-to-temp + rename is atomic on all target filesystems (POSIX, macOS APFS); no partial-write corruption
3. **Recovery simplicity**: load one file, scan for incomplete operations, resume — no cross-file reconciliation
4. **State size**: per-agent state is small (hundreds of inbound_facts at most, pruned after retention window); full rewrite is negligible cost

### Trade-off accepted

The entire state file is rewritten on each mutation. For Bridge's workload (messages per minute, not per second), this is acceptable. If message volume exceeds file I/O capacity in a future scenario, migration to SQLite (Option B) is straightforward because the schema is identical — only the storage layer changes.

## Consequences

- **Positive**: One file to back up, one file to inspect, one file to recover from
- **Positive**: No cross-file consistency bugs (the class of bug that caused v1 recovery ambiguity)
- **Negative**: Full rewrite per mutation (acceptable for current volume)
- **Rejected**: Option C preserves v1's failure mode (multiple authorities) and adds complexity (manifest)
