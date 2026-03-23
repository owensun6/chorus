# Bridge v2 Design Freeze — Writing Plan

> Status: Draft
> Purpose: define how Bridge v2 design should be written, reviewed, and frozen.
> Scope: this file is a writing plan, not the Bridge v2 design itself.
> Lifecycle: temporary scaffolding; remove after `docs/bridge-v2-design-freeze.md` is accepted.

## Why This Exists

Bridge v2 cannot start from the old bridge code, old bridge docs, or channel-specific implementation accidents.

Bridge v1 proved that some runtime paths can pass verification, but it still exposed model-level failures that justify a v2 design freeze:

1. session isolation prevented format leakage, but also split continuity between the user's live conversation and chorus-side turns
2. runtime-only delivery state meant stream delivery could not be treated as durable local delivery
3. bridge truth was split across session state, sidecar files, and runtime memory, which made recovery semantics unclear

This plan exists to force the next document to answer the right questions in the right order:

1. define the problem before defining the implementation
2. define boundaries before defining modules
3. define state ownership before defining flows
4. define hard constraints before defining recovery behavior

Without this order, Bridge v2 will repeat Bridge v1's failure mode: patching around a wrong model.

## Output Goal

The next document, `docs/bridge-v2-design-freeze.md`, should freeze the problem definition for Bridge v2.

It should make these questions unambiguous:

- what Bridge is
- what Bridge is not
- what state belongs where
- what system facts cannot be violated
- what a later implementation is allowed to assume

## Writing Order

The design freeze must be written in exactly five parts.

### 1. Purpose

This section answers one thing only:

- what Bridge v2 must solve

It must define Bridge at the correct abstraction level.
It must not start from a specific channel, plugin hook, token mechanism, or old patch history.

This section exists to stop the document from drifting into implementation-first thinking.

### 2. Non-Goals

This section answers:

- what Bridge v2 explicitly does not solve

It must cut off the most dangerous false directions early, including:

- channel-specific design as the starting point
- using session as a universal memory container
- relying on runtime accidents as architecture
- treating old bridge patches as a valid baseline

This section exists to prevent boundary creep.

### 3. Terms And Boundaries

This section answers:

- what each core term means
- where each subsystem begins and ends

At minimum it must define:

- Bridge
- Skill
- Hub
- host runtime
- main session
- chorus session
- sidecar state
- runtime ephemeral state
- local delivery
- relay
- continuity

This section exists to prevent the same word from carrying different meanings in different places.

### 4. State Ownership

This section answers:

- which state belongs in which storage or runtime layer

At minimum it must classify:

- route identity
- user conversation context
- chorus protocol context
- per-peer continuity
- inbox and delivery ledger
- seen ledger
- cursor
- transient runtime handles

This section is the core of the whole document.
Bridge v1 failed mainly because state lived in the wrong places.

### 5. Hard Constraints

This section answers:

- which host realities and protocol truths are non-negotiable

It must separate two things clearly:

- hard constraints: host realities and protocol facts that later design cannot violate
- design disciplines: rules Bridge v2 chooses to enforce to stay coherent

Examples of hard constraints:

- host memory grain is session-scoped
- some delivery capabilities are runtime-only
- transport acceptance is not equal to local delivery

Examples of design disciplines:

- no behavior may depend on duplicated truth sources
- bridge control flow must be derived from explicit state, not inferred from transcript accidents

This section exists to stop the design from sliding back into optimistic patch logic.

## Writing Rules

The future design freeze must follow these rules:

1. no channel name in the definition of Bridge itself
2. no implementation file paths in the first two sections
3. no recovery logic before state ownership is defined
4. no "maybe" architecture built on undocumented runtime behavior
5. no archived document cited as authority; archived files are evidence only

## Review Gate

### Design Freeze Review Criteria

Before `docs/bridge-v2-design-freeze.md` is accepted, it must be reviewed for:

- boundary clarity
- term consistency
- state ownership completeness
- constraint realism
- contamination from archived bridge assumptions

### Plan Acceptance Criteria

Acceptance for this plan:

- the five-part structure is fixed
- the purpose of each part is explicit
- archived documents are excluded as design authority
- Bridge v2 can be written from this plan without reintroducing old bridge assumptions

If any of these fail, the design freeze is not ready to drive implementation.
