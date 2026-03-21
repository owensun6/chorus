# Chorus Protocol

Version 0.4 | Link agents across platforms.

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to be interpreted as described in RFC 2119.

## 1. What is Chorus

Chorus is an agent-to-agent communication standard that links agents across platforms, languages, and cultures.

## 2. The Envelope

A JSON object:

- chorus_version (string, MUST): "0.4"
- sender_id (string, MUST): Sender address, format `name@host`
- original_text (string, MUST): The original message
- sender_culture (string, MUST): BCP 47 tag
- cultural_context (string 10-500, MAY): Optional hint — why the sender said it this way, in sender's language. Most receivers can adapt without it
- conversation_id (string max 64, MAY): Multi-turn identifier
- turn_number (integer ≥ 1, MAY): Turn counter

`sender_id` format: `name@host`. `host` is the Chorus server domain or peer address. Uniqueness is guaranteed by the host's namespace.

Additional fields permitted. Formal schema: `envelope.schema.json`

## 3. Rules

### Sending

1. MAY include `cultural_context` as a hint to the receiver when sender and receiver cultures differ
2. MUST NOT include personality or style in `cultural_context`

### Receiving

1. MUST validate the envelope before processing. If invalid, MUST respond with an error
2. MUST deliver the message in a form the receiver can understand
3. MAY deliver without adaptation when culture and language are the same

### Response

A JSON object returned to the sender:

- status (string, MUST): "ok" or "error"
- error_code (string, when error): See below
- detail (string, MAY): Human-readable description

Error codes:

- `INVALID_ENVELOPE` — Required fields missing or wrong type
- `UNSUPPORTED_VERSION` — `chorus_version` not recognized
- `ADAPTATION_FAILED` — Receiver could not process the message

Transport-level errors (delivery failure, timeout, unknown sender) are defined by L3.

### Constraints

- MUST NOT include personality or style in the envelope
- When present, `cultural_context` MUST be in the sender's language

## 4. Not In Scope

- Transport: how envelopes travel between agents
- Discovery: how agents initially find each other's addresses
- Authentication: how agents verify identity
- Personality: how an agent speaks
- Storage: how history is persisted

## 5. Versioning

0.4 is not backwards compatible with 0.2/0.3. Breaking changes from 0.2/0.3:

- `original_semantic` renamed to `original_text`
- `cultural_context` changed from conditional to optional (MAY)

Legacy envelopes using `original_semantic` or `chorus_version` values below `"0.4"` are not accepted. Senders MUST upgrade to 0.4 envelope format. There is no migration bridge — this is a pre-1.0 protocol and backwards compatibility is not guaranteed until 1.0.
