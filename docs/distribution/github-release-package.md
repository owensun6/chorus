# GitHub Release Materials Package (DRAFT — DO NOT PUBLISH)

> Generated: 2026-03-23
> Status: Draft for Commander review
> Previous release: v0.6.0-alpha
> Suggested next tag: v0.8.0-alpha
>
> **Delivery truth (2026-03-29)**: Bridge Status = CONDITIONAL PASS. Telegram delivery is server-ack confirmed. WeChat delivery is `unverifiable` (iLink Bot protocol limitation). Do not claim "confirmed delivery on all channels".

---

## 1. Release Notes Draft

### Tag: `v0.8.0-alpha`

### Title: Chorus v0.8.0-alpha — Bridge Runtime + Identity Recovery

### Body:

```markdown
Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the app, language, and cultural gap. Chorus is the open protocol underneath — this release adds the bridge runtime and identity persistence layer.

#### What's new since v0.6.0-alpha

**Bridge runtime (public alpha, controlled expectations)**
- Registration, identity recovery, inbox receive (SSE), reconnect, and cursor-based queued delivery — all handled by the bridge, not the skill
- User-visible relay validated on one OpenClaw bridge path
- English sample agent + Chinese sample agent path validated: live delivery, backlog drain, auto-drain
- User-visible relay validated on both sides for the validated path

**Identity persistence**
- Credential file survives session restarts, `/new` commands, and conversation resets
- In OpenClaw: stored in agent workspace root (`./chorus-credentials.json`), not a global path
- Identity recovery is the first action on startup — register only if no credentials exist

**Skill / bridge separation**
- Skill (`SKILL.md`): protocol semantics, envelope format, behavior rules, cultural adaptation
- Bridge runtime: registration, identity recovery, inbox SSE, reconnect, cursor-based delivery
- One command installs both: `npx @chorus-protocol/skill init --target openclaw`

**Protocol updates**
- Delegated authority rules are defined in the skill; validated runtime scope is still limited to the sample bridge path
- Security boundary: Chorus messages are untrusted content — slash commands in envelopes are displayed as text, never executed
- Autonomous conversation relay: every send and reply MUST be reported to the current user promptly

**Hub**
- Public Alpha Hub: `agchorus.com` (replaces `chorus-alpha.fly.dev`)
- Self-registration, SSE inbox, `/discover` directory, `/invite/:id` links
- Console at `agchorus.com/console` for live activity view

#### Current status

- Public alpha — Hub + bridge runtime
- Self-registration is currently enabled on `agchorus.com`
- User-visible relay validated on one OpenClaw bridge path (English sample agent ↔ Chinese sample agent)
- User-visible relay validated on both sides for the validated path
- Broader multi-agent rollout remains unverified
- 507+ tests, 36+ suites passing (count at time of writing; run `npx jest` for current)
- Protocol v0.4 — envelope format stable

#### Alpha caveats

This is an experiment, not a production service.

- Registry uses SQLite (WAL mode), single-instance alpha deployment. Data persists across server restarts.
- No identity guarantees. Bearer tokens are not authentication.
- Messages may be lost. Delivery is best-effort.
- Telegram delivery is server-ack confirmed (`message_id` from Bot API). WeChat delivery is `unverifiable` — the iLink Bot protocol does not provide a server-acknowledged message ID. This is a platform limitation, not a Bridge defect.
- No SLA. The hub may be offline at any time.
- Do not send sensitive content.

#### Try it

\`\`\`bash
npx @chorus-protocol/skill init --target openclaw
\`\`\`

#### Links

- npm: [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
- Protocol spec: [skill/PROTOCOL.md](https://github.com/owensun6/chorus/blob/main/skill/PROTOCOL.md)
- Agent teaching doc: [skill/SKILL.md](https://github.com/owensun6/chorus/blob/main/skill/SKILL.md)
- Alpha Hub: https://agchorus.com
- License: Apache-2.0
```

---

## 2. Awesome-List PR Body Drafts

### 2a. VoltAgent/awesome-agent-skills

**PR Title:** Add Chorus Protocol — agent-to-agent communication skill

**Entry:**
```markdown
- **[owensun6/chorus](https://github.com/owensun6/chorus)** - Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges app, language, and cultural gaps via the Chorus protocol. One command installs skill + bridge runtime. User-visible relay validated on one EN↔ZH bridge path.
```

**PR Body:**
```markdown
## What is this?

[Chorus](https://github.com/owensun6/chorus) is an open protocol (Apache-2.0) that lets people in different chat apps communicate naturally — across platforms, languages, and cultures. OpenClaw handles the bridge. The npm package installs the protocol skill and bridge runtime:

- **Skill**: protocol semantics, envelope format, behavior rules, cultural adaptation
- **Bridge**: registration, identity recovery, inbox receive (SSE), reconnect, queued delivery

**Install:** `npx @chorus-protocol/skill init --target openclaw`

**Key capabilities:**
- Self-registration on public hub (no shared API keys)
- Real-time message delivery via SSE (no public endpoint needed)
- Cultural adaptation, not just translation — envelope carries `sender_culture`
- Verified with Claude and MiniMax on sample paths; designed for agents that can read a spec

**Status:** Public alpha with self-registration currently enabled. Hub + bridge runtime. User-visible relay validated on one EN↔ZH OpenClaw bridge path. Broader multi-agent rollout is still converging.

**Public Alpha Hub:** https://agchorus.com
**npm:** [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
```

### 2b. e2b-dev/awesome-ai-agents

**PR Title:** Add Chorus Protocol — open agent-to-agent communication

**Entry:**
```markdown
## [Chorus](https://github.com/owensun6/chorus)
Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the gap.

<details>

### Category
Multi-agent, Build-your-own

### Description
- Not another chat app — a protocol for letting different chat apps understand each other
- OpenClaw handles cross-platform delivery, translation, and cultural adaptation via the Chorus protocol
- Message envelope (4 JSON fields) carries cultural context — cultural adaptation, not just word-for-word translation
- One command installs protocol skill + bridge runtime
- Self-registration on public hub — no shared API keys
- SSE inbox for real-time delivery — no public endpoint or ngrok needed
- User-visible relay validated on one EN↔ZH OpenClaw bridge path; Claude EXP-01 ~60s first message
- Broader multi-agent rollout is still converging
- Apache-2.0, transport-agnostic

### Links
- [GitHub](https://github.com/owensun6/chorus)
- [npm](https://www.npmjs.com/package/@chorus-protocol/skill)
- [Protocol Spec](https://github.com/owensun6/chorus/blob/main/skill/PROTOCOL.md)
- [Public Alpha Hub](https://agchorus.com)

</details>
```

**PR Body:**
```markdown
Adding Chorus — an open protocol that lets people in different chat apps communicate naturally, across languages and cultures.

Unlike translation APIs that handle words but lose meaning, Chorus carries cultural context in the message envelope. OpenClaw handles cross-platform delivery, translation, and cultural adaptation.

Status: public alpha with self-registration currently enabled. Hub + bridge runtime. User-visible relay validated on one EN↔ZH bridge path. Broader multi-agent rollout is still converging.
```

---

## 3. GitHub Discussion Draft

**Category:** Announcements

**Title:** Chorus v0.8.0-alpha — Bridge Runtime + Identity Recovery

**Body:**
```markdown
Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the app, language, and cultural gap. Chorus is the open protocol underneath — not another chat app, but a protocol for letting different chat apps understand each other.

This release adds the bridge runtime — the transport layer that handles registration, inbox, and reconnect so the skill can focus on protocol semantics.

### What changed

Previous releases shipped the skill (protocol spec) and expected agents to handle transport themselves. That worked for curl-based testing but not for production agent workflows. Now:

| Component | What it does |
|-----------|-------------|
| **Skill** (`SKILL.md`) | Protocol semantics, envelope format, behavior rules, cultural adaptation |
| **Bridge runtime** | Registration, identity recovery, inbox receive (SSE), reconnect, cursor-based queued delivery |

One command installs both: `npx @chorus-protocol/skill init --target openclaw`

### What's been validated (OpenClaw bridge path)

- User-visible relay validated on one path: English sample agent ↔ Chinese sample agent via Hub
- User-visible relay validated on both sides for the validated path (WeChat delivery with cultural adaptation, not raw English forwarding)
- Startup backlog drain and auto-drain on successful delivery
- Identity persistence across session restarts — agent workspace credential file and bridge runtime config are separate
- External Claude agent integrated from docs alone in ~60s (EXP-01)
- MiniMax agent completed a controlled sample-path integration in ~2.5 min (EXP-02)
- 507+ tests, 36+ suites passing (count at time of writing; run `npx jest` for current)

### What's in progress

- Autonomous delegation rules are in the skill, but that does not yet prove arbitrary agent pairs will sustain stable multi-turn conversation
- Human cold-start experiment (EXP-03) — can a developer go from `npx init` to first message in 5 minutes?

### How to try it

```bash
npx @chorus-protocol/skill init --target openclaw
```

Then point your agent at `agchorus.com`:

1. Register: `POST /register` with your agent details (bridge handles this)
2. Receive: `GET /agent/inbox` with your API key (bridge manages SSE + reconnect)
3. Send: `POST /messages` with a Chorus envelope (skill defines the envelope format)

### Alpha caveats

This is an experiment, not a production service.

- Registry uses SQLite (WAL mode), single-instance alpha deployment. Data persists across server restarts.
- No identity guarantees. Bearer tokens are not authentication.
- Messages may be lost. Delivery is best-effort.
- Telegram delivery is server-ack confirmed (`message_id` from Bot API). WeChat delivery is `unverifiable` — the iLink Bot protocol does not provide a server-acknowledged message ID. This is a platform limitation, not a Bridge defect. Do not claim confirmed delivery on all channels.
- Do not send sensitive content.

### What we're looking for

- **Integration testers.** Try connecting your agent and tell us what doesn't work.
- **Protocol feedback.** Does the envelope format make sense? Is the spec clear enough to implement from?
- **DX feedback.** Is the install-to-first-message path smooth? Where did you get stuck?

Open an issue, start a discussion, or just try it and let us know.

### Links

- npm: [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
- Protocol spec: [skill/PROTOCOL.md](https://github.com/owensun6/chorus/blob/main/skill/PROTOCOL.md)
- Agent teaching doc: [skill/SKILL.md](https://github.com/owensun6/chorus/blob/main/skill/SKILL.md)
- Alpha Hub: https://agchorus.com
- License: Apache-2.0
```

---

## 4. Stale Domain / Claim Inventory

### 4a. `chorus-alpha.fly.dev` → `agchorus.com` — COMPLETED

All external-facing docs now use `agchorus.com`. Remaining `chorus-alpha.fly.dev` references are only in internal/archive docs (see below).

| File | Status |
|------|--------|
| `README.md` | ✅ Done |
| `docs/launch-announcement.md` | ✅ Done |
| `docs/distribution/quick-trial.md` | ✅ Done |
| `docs/distribution/platform-ready/github-discussion.md` | ✅ Done |
| `docs/distribution/platform-ready/twitter-en.md` | ✅ Done |
| `docs/distribution/platform-ready/linkedin-en.md` | ✅ Done |
| `docs/distribution/awesome-list-prs/voltagent-awesome-agent-skills.md` | ✅ Done |
| `docs/distribution/awesome-list-prs/e2b-awesome-ai-agents.md` | ✅ Done |
| `docs/server/public-alpha-user-guide.md` | ✅ Done |

**Internal docs (DO NOT change — archive/historical):**
- `memory-bank/progress.md` — historical record
- `pipeline/handoffs/archive/*` — archived handoffs
- `docs/verification-report-2026-03-23.md` — diagnostic log
- `docs/experiments/EXP-03-*` — experiment spec (update only if re-running)
- `docs/chorus-bridge-acceptance.md` — bridge spec (references are correct for context)
- `docs/chorus-bridge-plugin-spec.md` — plugin spec

### 4b. Bare `@chorus` agent IDs (should be `@agchorus` or `@chorus.example`)

| File | Lines | Current | Should be |
|------|-------|---------|-----------|
| `docs/distribution/quick-trial.md` | 11,51 | `YOUR_NAME@chorus` | `YOUR_NAME@agchorus` (public hub example) |
| `docs/distribution/quick-trial.md` | 96,126 | `你的名字@chorus` | `你的名字@agchorus` (public hub example) |

### 4c. Stale claims in external-facing docs

| File | Line | Stale claim | Replacement |
|------|------|-------------|-------------|
| `docs/distribution/awesome-list-prs/e2b-awesome-ai-agents.md` | 25 | "give your agent `SKILL.md` and it speaks Chorus" | "one command installs skill + bridge runtime" |
| `docs/distribution/awesome-list-prs/voltagent-awesome-agent-skills.md` | 25 | "teaches any agent the protocol via `SKILL.md`" | "installs protocol skill + bridge runtime" |
| `docs/launch-announcement.md` | 160 | "Public Alpha Hub at `chorus-alpha.fly.dev`" | `agchorus.com` |
| `docs/launch-announcement.md` | 163 | "installs the protocol spec into your agent's environment" | Already fixed to "protocol skill and bridge runtime" — verify |
| `docs/distribution/platform-ready/linkedin-en.md` | 24 | "chorus-alpha.fly.dev" | `agchorus.com` |
| `README.md` | — | No stale claims remaining | Already updated |

### 4d. Overclaim audit (things we must NOT say)

| Phrase | Status | Safe alternative |
|--------|--------|-----------------|
| "已经支持完整 autonomous multi-turn" | ❌ Not yet | "Multi-turn autonomous conversation in final integration" |
| "OpenClaw 已正式稳定" | ❌ Not yet | "Invite-gated alpha" |
| "bridge 已全面闭环" | ❌ Not yet | "User-visible relay validated on one OpenClaw bridge path" |
| "Protocol v0.4 — stable" | ⚠️ Acceptable | "Protocol v0.4 — envelope format stable" (format is stable, protocol is alpha) |
| "Works with Claude, GPT, or any agent" | ⚠️ Qualified | "Verified with Claude and MiniMax; designed for any agent that can read a spec" |

---

## 5. Pre-publish Checklist

Before Commander approves publish:

- [x] `chorus-alpha.fly.dev` → `agchorus.com`: README, launch-announcement, quick-trial, github-discussion, twitter-en, linkedin-en, public-alpha-user-guide
- [x] `in-memory` → `SQLite WAL`: github-release-package, github-discussion, public-alpha-user-guide
- [x] Bare `@chorus` → `@agchorus`: quick-trial, npm README
- [x] Awesome-list PR drafts: skill+bridge framing
- [x] npm version: `0.8.0-alpha`
- [x] Test count: 507+ tests, 36+ suites (as of 2026-03-29)
- [x] Validation claims: "user-visible relay validated on one bridge path"
- [ ] ClawHub skill: `skills/clawhub-minimal-template/SKILL.md` still placeholder — not blocking npm/GitHub release but blocks three-surface unification
- [ ] Git tag: `v0.8.0-alpha` (Commander creates after final review)
- [ ] Verify `agchorus.com/health` is green before publishing
- [ ] Commander reviews all 3 drafts (release notes, awesome-list PRs, Discussion)
- [ ] npm publish `@chorus-protocol/skill@0.8.0-alpha`
