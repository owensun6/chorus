<!-- Author: 道一 (Claude Sonnet 4.6) -->
<!-- Status: DRAFT v2 — P0-4 resolved + NEW P0-5 added -->

# Launch Copy Audit — 2026-04-07

> **Scope**: Pre-launch audit of `docs/launch-announcement.md`, `docs/distribution/v0.8.0-alpha-launch-kit.md`, and `docs/distribution/release-claims-boundary.md` against (a) the project's own claims-boundary gate, (b) independent community/competitive landscape research, and (c) verified evidence in the bridge-v2-validation pipeline.
>
> **Verdict (v2)**: **CONDITIONAL PASS**. 5 P0 issues must be fixed before public launch. 3 SHOULD-fix items are non-blocking but high-value.
>
> **v2 changes (2026-04-07)**:
> - P0-4 (xiaov↔xiaox verification scope) → **RESOLVED** as interpretation A+ (stronger than expected). See P0-4 below.
> - NEW **P0-5** added: IMPL-EXP03-04 unfixed Telegram polling disconnect creates a post-install UX cliff that must either be fixed or explicitly caveated.
> - NEW **P0-6** added: launch copy hero scenario should be updated to reflect the actual verified path (cold-start cross-machine, not the outdated xiaov↔xiaox).

---

## Materials reviewed

| File | Status | Purpose |
|------|--------|---------|
| `docs/launch-announcement.md` | active | EN/ZH Twitter threads + 1-pager + GitHub Release body |
| `docs/distribution/v0.8.0-alpha-launch-kit.md` | **ARCHIVED** (per file header) | Older draft, do not ship |
| `docs/distribution/release-claims-boundary.md` | active gate | Claims boundary rules |
| `README.md` | active | Public README, source of truth for "Bridge Status" table |
| `pipeline/bridge-v2-validation/evidence/*` | active | Verified runtime evidence |

---

## Strengths (carry forward)

1. **`release-claims-boundary.md` is mature engineering discipline.** Explicit "allowed phrasing" and "disallowed claims" with named target files (`README.md`, `launch-kit.md`, etc.) is unusually rigorous for a pre-launch project. Most open-source launches lack this discipline entirely.
2. **Transparent evidence:** EXP-01 (~60s, External Claude) and EXP-02 (~2.5min, MiniMax) are time-stamped, scoped, and used carefully in copy.
3. **"What Chorus is NOT" section** in GitHub Release body proactively defends against common misreadings (auto-chat-out-of-the-box, A2A replacement, production SLA).
4. **Hub is real.** `agchorus.com` is running, not vaporware. This is the single biggest differentiator vs. A2A.
5. **EN + ZH parity** across tweet thread and 1-pager.

---

## Findings

### 🔴 P0-1 — WeChat coverage gap (honesty risk)

**Issue**: `README.md` Bridge Status table explicitly marks WeChat delivery as `BLOCKED — iLink Bot protocol returns no server ACK`. The active claims boundary requires WeChat-unverifiable caveats. **But `launch-announcement.md` does not surface this.**

Specifically:

- **Tweet 2 (Problem)** uses example: *"Someone on WeChat wants to talk to someone on Telegram"*
- **1-Pager (EN + ZH)** says: *"OpenClaw handles cross-platform delivery, translation, and cultural adaptation"* (implies WeChat is symmetric to Telegram)

**Predicted failure mode**: First wave of users will test the WeChat path, hit the unverified delivery, and post issues claiming false advertising. Even if README has the fine print, the launch tweet has already done damage.

**Fix**:

1. Tweet 2 — replace WeChat example with one of:
   - *"Two Telegram users in different languages"*
   - *"Slack ↔ Telegram"* (only if Slack path is verified)
   - *"A Japanese-speaking developer wants their AI agent to talk to a Chinese-speaking team's agent"* (cleanly avoids platform asymmetry)
2. 1-Pager — add inline caveat: *"Telegram delivery is server-ack confirmed; WeChat delivery is best-effort due to platform limitations (alpha caveat)."*
3. GitHub Release body — copy the README "Bridge Status" table verbatim into the release notes so readers see the verified scope inline, not in a separate file.

---

### 🟡 P0-2 — Burying the strongest differentiator

**Issue**: The actual strongest differentiator vs. the existing agent-protocol ecosystem is **"public hub" vs A2A's "spec-only"**. Independent community scan (2026-04-07) confirmed:

| Project | What | Public hub? |
|---------|------|------------|
| **A2A** (Google → Linux Foundation, donated 2025-06) | Agent2Agent protocol spec + 5-language SDKs | ❌ No public hub. Verified by direct GitHub fetch. |
| **OpenClaw ACP** | IDE ↔ OpenClaw Gateway bridge | ❌ Wrong scope (IDE→agent, not agent→agent) |
| **OpenClaw native multi-agent** | Per-instance shared workspace dirs | ❌ Single-instance, file-based |
| **OAP** (LangGraph/LangChain) | Framework-internal interop | ❌ Framework-bound, not open hub |
| **engram_translator** | Protocol-translation middleware | ❌ Bridge between protocols, not message routing |
| **Microsoft Agent 365 / Okta for AI Agents** | Enterprise IAM agent registries | ❌ Closed, paid, no message hub |
| **ai.wot + Nostr NIP-32** | Decentralized agent reputation | ❌ Quality scoring, not messaging |
| **Chorus** | Protocol + **public hub** + bridge runtime | ✅ |

A2A donated to Linux Foundation **a year ago** (2025-06). No one has stood up a public hub in that time. **This is Chorus's defensible market gap.**

But Tweet 1 (the hook) reads:
> *"Talk across chat apps and languages with OpenClaw agents."*

This is a product description, not a hook. Western developers will read it as "another translation thing" and scroll past.

**Fix**: Re-anchor Tweet 1 (English) to the hub gap. Suggested rewrite:

> **Agent-to-agent protocols got hubs. A2A wrote the spec a year ago and no one deployed a public one. We did.**
>
> Self-register, get an API key, send messages to any agent. Agents handle their own language and cultural adaptation locally.
>
> agchorus.com · github.com/owensun6/chorus · Apache-2.0

Rationale:
- Direct A2A reference anchors Chorus in a frame any agent-infra reader already has
- "a year ago and no one deployed a public one" creates curiosity
- Cultural adaptation is downgraded from hero to bonus feature
- Hub URL leads, GitHub follows

**Tweet 7 (CTA)** must also include:

> *"A2A wrote the protocol spec. We built the hub. They're complementary, not competitive."*

This pre-empts the inevitable "is this A2A?" question. If it's not answered in the thread, every reader makes their own (often wrong) inference.

---

### 🟡 P0-3 — Cultural adaptation framing doesn't translate to Western audiences

**Issue**: The Chinese thread uses "送钟" (gift-giving taboo) as the cultural example — Chinese readers get this in 1 second. The English thread leans on the same cultural-adaptation angle as the lead.

**Western developer reaction is likely**: *"DeepL handles localization. So what?"*

Cultural adaptation is a real differentiator, but it works as a **bonus feature**, not a hero feature, for English-speaking developer audience.

**Fix**:
- **English thread**: lead with the public hub angle (P0-2 fix). Treat cultural adaptation as: *"and as a bonus, the envelope carries cultural context, so receiving agents can adapt locally instead of relying on a server-side translation lossy pipe."*
- **Chinese thread**: leave as-is. Cultural adaptation IS a strong lead for Chinese developer audience because cross-cultural communication friction is lived experience.

The two threads are allowed to have different leads. They're targeting different mental models.

---

### 🟢 P0-4 — RESOLVED: Cross-machine verification is real and stronger than expected

**Resolution date**: 2026-04-07

**Original concern**: launch-announcement.md referenced "xiaov@openclaw ↔ xiaox@chorus" as the verified path. I asked whether this was self-test or true cross-instance.

**Commander clarification**: That reference is **outdated**. The actual current verified path is **EXP-03 Run 2 (2026-04-03)** on `alpha.9`, which tested:

- **Subject machine**: MacBook (test2) — running its own OpenClaw runtime
- **Conductor machine**: Mac mini — running a different OpenClaw runtime, hosting `xiaox@chorus` (changed from `xiaoyin@chorus` because xiaoyin API key was lost during `~/.chorus/` cleanup)
- **Subject scenario**: Cold-start human developer simulation — agent had **never seen Chorus before**, self-installed from scratch
- **Timeline**: 18:40 cold-start → 18:41 install complete + restart request → 18:42 user approval → **18:46 Chorus message visible on Telegram**
- **Total time**: 6 minutes from zero to first cross-machine cross-OpenClaw message
- **Subject agent ID**: `openclaw-test@agchorus`
- **Hub trace**: `0c02a49a-4051-4391-8b22-ca27613f269d`, `delivery_confirmed`, `telegram_server_ack ref=147`
- **Test version**: `@chorus-protocol/skill@0.8.0-alpha.9` (commit `bbf7f9c`, tag `v0.8.0-alpha.9`)
- **Outcome**: PASS — C-1 through C-11 all satisfied (full criteria coverage)

This is **interpretation A+** — not just "cross-instance same machine" but **physically separate machines, fully cold-start, real human-developer simulation, telegram-confirmed**. The actual story is significantly stronger than the launch copy currently tells.

**Evidence files**:
- `pipeline/handoffs/260403-exp03-run2-handoff.md` — Run 2 PASS handoff
- `pipeline/bridge-v2-validation/evidence/EXP-03-run2-preflight-20260401.md` — pre-flight (alpha.8 baseline)
- `docs/experiments/EXP-03-human-developer-cold-start.md` — protocol spec
- (still pending) Run 2 formal summary file at `docs/experiment-results/EXP-03-summary.md` — currently shows Run 1 VOID, must be updated to include Run 2 PASS before launch

**Implication for the launch**: P0-4 not only passes but **the launch copy is currently underselling the real achievement**. The actual hero story should be:

> *"A developer who had never seen Chorus before installed it on their own machine and exchanged a message with an agent on another machine in 6 minutes. From cold-start to delivered. Cross-machine, cross-OpenClaw, Telegram server-ack confirmed."*

This is concretely demonstrable — there's a Hub trace ID, a `telegram_server_ack ref`, screen recordings, gateway logs. It's not "we tested with two agents we own" — it's "we tested with a cold-start subject on a separate machine in a controlled experiment with full audit trail."

See P0-6 below for the specific copy update this enables.

---

### 🔴 P0-5 — Unfixed IMPL-EXP03-04 (Telegram polling disconnect after install)

**NEW finding from EXP-03 Run 2 review.**

**Issue**: Run 2 PASSed because C-1 through C-11 were satisfied at 18:46 (Chorus message delivered to Telegram). But **immediately after delivery, the subject's Telegram bot stopped responding to ordinary messages**.

Root cause (per `pipeline/handoffs/260403-exp03-run2-handoff.md` and 2026-04-04 静态分析):

> `restart-consent approve` writes `openclaw.json` to remove the `tools.deny.gateway` block. `openclaw.json` is OpenClaw's hot-reload config file, so this write triggers a watcher reload, which cascades into a second OpenClaw restart. The Telegram polling connection does not recover from this second restart.

**Current state**: A task spec exists at `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` and a P0 fix is queued. **Not yet implemented.**

**Why this matters for launch**:

| Scenario | Currently broken? |
|----------|------------------|
| Cold-start install → first Chorus message delivery | ✅ Works (EXP-03 Run 2 PASS) |
| Sustained Telegram chat *after* Chorus install | ❌ Broken (polling disconnects) |

The launch copy implicitly promises both. The cold-start happy path is the marketing money shot, but the **first thing a user does after seeing the demo work** is try to keep using Telegram normally — and that's where the post-install cliff hits.

**Predicted failure mode**: Launch goes well. First 50 users complete the 6-minute quickstart and see the cross-machine message arrive. Then they try to chat with their Telegram bot normally and discover their bot is broken. Issue tracker fills with "Telegram bot dead after Chorus install."

**Two acceptable resolutions** (pick one before launch):

**Option 1 (preferred): Fix IMPL-EXP03-04 before launch**

The fix is well-scoped per the static analysis in 260403-exp03-run2-handoff.md §补充分析:
- `approve` only updates `~/.chorus/restart-consent.json`
- `approve` does **not** write `openclaw.json`
- `complete` performs the single consolidated write: remove `gateway` from `tools.deny`, write `openclaw.json` once, delete gate/checkpoint

This compresses total writes from 2-3 to 1. Decouples logical state from runtime side-effects. Fix is bounded and identified.

**Time estimate**: A few hours of focused work + verification that the approve→restart→complete time sequence still closes (the open question identified in the analysis: does the restart still happen automatically when `tools.deny.gateway` removal is delayed to `complete`?).

**Option 2 (acceptable but worse): Explicit caveat in launch copy**

If the fix cannot land before launch, every launch surface must include:

> *"Alpha caveat: Installing Chorus may temporarily disrupt your existing Telegram bot polling. If your bot stops responding after install, restart your OpenClaw gateway. This is tracked as IMPL-EXP03-04 and will be fixed in alpha.10."*

This is honest but ugly. It significantly weakens the cold-start story because the "6 minutes to first message" framing is undercut by "and your bot might break after."

**Recommendation**: Fix it. Option 1 is the right call. The fix is small, the analysis is done, and it would unblock a much cleaner launch story.

---

### 🟡 P0-6 — Update launch copy hero scenario to match actual evidence

**Issue**: Now that P0-4 is resolved, all launch copy references to `xiaov@openclaw ↔ xiaox@chorus` are not just outdated — they're **understating** the real verification.

**Files to update**:

1. **`docs/launch-announcement.md`** §3 (1-Pager EN) — currently says:
   > *"One user-visible EN↔ZH sample path is validated in the OpenClaw bridge path."*
   
   Should say:
   > *"Verified end-to-end on EXP-03 Run 2 (2026-04-03): a cold-start subject on MacBook installed Chorus from scratch and exchanged a Telegram-confirmed message with an agent on a separate Mac mini in 6 minutes. Hub trace `0c02a49a`, telegram_server_ack ref=147."*

2. **`docs/launch-announcement.md`** §5 (GitHub Release body) Evidence table — currently:
   ```
   | EXP-01 | External Claude (Anthropic) | PASS — valid envelope, cross-cultural delivery, zero corrections | ~60s |
   | EXP-02 | xiaox (MiniMax-M2.7) | CONDITIONAL PASS — controlled sample-path integration | ~2.5 min |
   ```
   
   Add row:
   ```
   | EXP-03 Run 2 | Cold-start human dev simulation, MacBook ↔ Mac mini (separate OpenClaw runtimes) | PASS — full cold-start to telegram-confirmed delivery, alpha.9, all 11 hard criteria met | ~6 min |
   ```
   
   This is the strongest evidence row. It belongs in the table.

3. **`docs/distribution/v0.8.0-alpha-launch-kit.md`** is marked ARCHIVED but it has the xiaov↔xiaox text — leave the ARCHIVED file as-is (history) and ensure the current `launch-announcement.md` doesn't repeat the outdated phrasing.

4. **`docs/experiment-results/EXP-03-summary.md`** is currently showing Run 1 (VOID). Must be updated to include Run 2 (PASS) before launch — this file is referenced as evidence and reviewers will look for the corresponding write-up.

5. **`README.md`** "Bridge Status" table — verify if it references the cross-machine result or only the Telegram/WeChat per-channel checks. If not, add a row.

---

## SHOULD-fix items (non-blocking)

### S-1 — Verify `Tweet 5` "zero corrections" claim

Tweet 5 (Evidence) says: *"An external Claude read the spec and delivered a cross-cultural message in ~60s, **zero corrections**."*

"Zero corrections" is a strong absolute claim. Verify against the EXP-01 evidence file. If the actual evidence says "minor corrections" or "one prompt clarification", downgrade to:

> *"...delivered a cross-cultural message in ~60s, with no protocol-spec corrections from the operator."*

The qualifier is honest and equally compelling.

### S-2 — Add comparison table to GitHub Release body

The GitHub Release body lacks an "alternatives" section. The first 100 readers will all wonder "how is this different from A2A / MCP / OAP?" Adding a comparison table inline cuts down 80% of "how is this different from X" comments in the first week.

Suggested table (drop into the GitHub Release body):

| Project | What | Status | Public hub? |
|---------|------|--------|------------|
| **A2A** | Agent2Agent protocol spec | Spec + SDKs | ❌ |
| **MCP** | Model Context Protocol | Tool ↔ agent | N/A |
| **OAP** | Open Agent Protocol (LangGraph) | Framework integration | ❌ |
| **OpenClaw ACP** | IDE ↔ Gateway bridge | Wrong scope | ❌ |
| **Chorus** | Cross-platform agent messaging | Protocol + hub + bridge runtime | ✅ |

### S-3 — Pre-launch infrastructure smoke test

24 hours before launch:
- `agchorus.com/health` returns 200, no errors in the past 24h
- `npm install @chorus-protocol/skill` succeeds from a clean Node environment
- Run the full 5-minute quickstart from a fresh terminal (not your dev machine), end-to-end, including the `/register → /agent/inbox SSE → /messages → delivery` flow
- Verify the tarball published to npm matches the GitHub tag (no `tag-then-publish` regression — see `gene-20260330-tag-then-publish`)

If any of these fail, the launch is not ready regardless of copy quality.

---

## Required actions checklist

**MUST (launch-blocking)**:

- [x] **P0-4** — RESOLVED. Cross-machine cold-start verification confirmed via EXP-03 Run 2 (2026-04-03 PASS, alpha.9)
- [ ] **P0-5** — Fix IMPL-EXP03-04 (Telegram polling disconnect after install). **In progress (Commander)** as of 2026-04-07. Preferred: ship the fix in alpha.10 before launch
- [x] **P0-6** — DONE. Hero scenario in `launch-announcement.md` now references EXP-03 Run 2 (cold-start, cross-machine, 6 min, alpha.9) across Tweet 5 (EN+ZH), 1-Pager (EN+ZH), and GitHub Release body evidence table. Outdated `xiaov↔xiaox` references removed
- [x] **P0-1** — DONE. WeChat-specific framing removed from Tweet 2 (EN+ZH) and 1-Pager. Explicit WeChat-unverifiable caveat added to Tweet 7 (EN+ZH), 1-Pager (EN+ZH), and GitHub Release body Alpha caveats section
- [x] **P0-2** — DONE. Tweet 1 (EN+ZH) rewritten around the public-hub-vs-A2A gap frame. Tweet 7 (EN+ZH) and 1-Pager now include A2A complementarity statement. GitHub Release body opens with the same A2A frame and the alternatives section explicitly states "complementary, not competitive"
- [x] **P0-3** — DONE. English thread Tweet 3 reframed: protocol minimalism is the lead, cultural adaptation downgraded to "bonus". Chinese thread Tweet 3 retains cultural adaptation framing (per audit recommendation — different audience mental model)

**SHOULD (high value, non-blocking)**:

- [x] **S-1** — Phrasing in Tweet 5 was completely rewritten as part of P0-6 (replaced with EXP-03 Run 2 evidence). Original "zero corrections" claim no longer in Tweet 5. The phrase still appears once in the GitHub Release body's EXP-01 row, downgraded to **"no protocol-spec corrections from operator"** which is the conservative honest version
- [x] **S-2** — DONE. Alternatives comparison table added to GitHub Release body under new section "How Chorus relates to other agent protocols". Includes A2A / MCP / OAP / OpenClaw ACP / engram_translator / Microsoft Agent 365 / Okta. Each row marks public-hub status. Section ends with the "SMTP for AI agents" analogy
- [ ] **S-3** — Run 24-hour pre-launch infrastructure smoke test (health check + npm install + clean E2E quickstart). **Not yet executed**
- [ ] **S-4** — Update `docs/experiment-results/EXP-03-summary.md` to include Run 2 PASS verdict (currently only shows Run 1 VOID). Reviewers and future maintainers will look here for the canonical Run 2 summary. **Not yet done**

---

## Open questions for Commander

1. ~~**P0-4 — interpretation A or B?**~~ **RESOLVED 2026-04-07** — interpretation A+ (cross-machine cold-start verified)
2. **P0-5 — Option 1 or Option 2?** Fix IMPL-EXP03-04 before launch (preferred) or ship with explicit caveat?
3. The Twitter handle is `@owensun6` per the GitHub URL. Is the tweet thread going to be posted from this account, or a different brand account?
4. Are there other launch channels not covered in `v0.8.0-alpha-launch-kit.md` §4 (Crosspost Publishing Checklist) that should be audited? (e.g., Hacker News submission timing, Reddit r/LocalLLaMA, etc.)
5. Any non-Western community channels planned (即刻 / V2EX / 少数派 / 知乎)?

---

## Boundary compliance summary

| Boundary rule | launch-announcement.md compliance |
|---------------|-----------------------------------|
| Allowed claim: "verified on one path" | ✅ Used in Release body |
| Allowed claim: "alpha, controlled rollout" | ✅ Used in Release body |
| Disallowed: "bidirectional verified" | ✅ Not used |
| Disallowed: "anyone, any language, any chat app" present-tense | ⚠️ 1-Pager phrasing borderline — "OpenClaw handles cross-platform delivery" implies more than is verified (see P0-1) |
| Required caveat: "Alpha, controlled rollout" | ✅ Present in Release body, MISSING from tweet thread |
| Required caveat: "best-effort delivery; no SLA" | ✅ Present in Release body, MISSING from tweet thread |
| Required caveat: "bridge does not mean arbitrary agents already chat stably out of the box" | ⚠️ Implicit, not explicit in tweet thread |

The tweet thread does not surface required caveats. Tweets are limited in space, but at minimum **Tweet 7 (CTA)** should include "Alpha — best-effort, no SLA, do not send sensitive content" as a one-liner.

---

## Verdict (v2)

**CONDITIONAL PASS** — pending P0-1, P0-2, P0-3, P0-5, P0-6 fixes.

P0-4 resolved as interpretation A+ (cross-machine cold-start verified, 2026-04-03 EXP-03 Run 2 PASS on alpha.9). The actual verified path is **stronger** than the launch copy currently claims.

**The story has gotten better, not worse**. The new launch positioning, after fixes, can be:

> *"Public hub for agent-to-agent messaging that A2A wrote a spec for but no one deployed. A cold-start developer on MacBook installed our protocol and exchanged a Telegram-confirmed message with an agent on a separate Mac mini in 6 minutes. Self-register, send envelopes, agents adapt locally for their user's culture. Apache-2.0."*

This is concretely demonstrable:
- Hub trace ID `0c02a49a-4051-4391-8b22-ca27613f269d`
- `telegram_server_ack ref=147`
- Tagged release `v0.8.0-alpha.9` with `bbf7f9c` commit
- Reproducible by anyone via `npx @chorus-protocol/skill@0.8.0-alpha.9 init --target openclaw`

**The launch is closer than the audit v1 implied**. The single biggest remaining technical risk is P0-5 (the post-install Telegram polling disconnect). Fix that, do the 5 copy edits, and Chorus can ship.

---

**Audit signed off by**: 道一 (Claude Sonnet 4.6), in collaboration with Commander
**Audit date**: 2026-04-07
**Audit version**: v3 (P0-1, P0-2, P0-3, P0-6, S-1, S-2 marked complete in `launch-announcement.md`; P0-5 in progress by Commander; S-3 + S-4 still pending)
**Remaining launch-blockers**: only P0-5 (IMPL-EXP03-04 fix) and S-3 (pre-launch smoke test). S-4 is documentation hygiene, not launch-blocking but recommended.
**Next review trigger**: After IMPL-EXP03-04 (P0-5) implementation lands, do a final pass on `launch-announcement.md` to verify no caveat needs to be added back
