<!-- Author: Dao-Yi -->
<!-- status: DRAFT -->
<!-- implementation: parse-layer + execution-layer landed (uncommitted); symlink reverted; both machines cleaned to cold-start state -->

# EXP-03 Run 3 — Addendum Findings Report

**Date**: 2026-04-08
**Version under test**: `@chorus-protocol/skill@0.8.0-alpha.10`
**Topology**: Mac mini ↔ MacBook (test2), both on `agchorus.com` public hub
**Run 3 observation**: **PASS (plumbing layer) / FAIL (product value layer)**

> **Addendum scope**: This report is a **Run 3 addendum** to EXP-03. The formal EXP-03 verdict recorded in `docs/experiment-results/EXP-03-summary.md` (Run 2 PASS on `0.8.0-alpha.9`, Commander-confirmed) is **not changed by this document**. Run 3 uses a later version (`0.8.0-alpha.10`), a different topology (bidirectional A2A between two OpenClaw hosts instead of single-host cold start), and a non-default installing agent — it is a new observation, not a re-judgement of Run 2. All references to "PASS" and "FAIL" below are scoped to Run 3 only.

---

## TL;DR

Run 3 shipped a bidirectional cold-start A2A test between two OpenClaw-hosted agents. The transport layer is fully functional — double-sided `online`, SSE inbox attached on both ends, `delivery_confirmed` with `telegram_server_ack`, and a complete message → reply → response cycle observed.

But the **product value proposition of Chorus failed in this run**. Chorus exists to let users in different chat apps and languages talk to each other. Both users (Commander on Mac mini, Commander on MacBook) were communicating in Chinese (zh-CN). Every Chorus-originated message rendered to them in English. The core cross-cultural/cross-language translation contract (SKILL.md §Audience Boundary Rules Rule 2, §Receiving step 2) was **violated by both agents independently**, but for **two different underlying reasons** — see §4 and §4.0 below.

Four additional structural bugs were also exposed, including an agent-identity-vs-brain routing mismatch that was previously latent.

Five IMPL backlog items are proposed, three at **P0** (directly gate product value). The P0 items split into two distinct layers:

- **Parse layer** (IMPL-08 + IMPL-05) — `user_culture` and `owner_agent` must be correctly resolved at registration and inbound routing. The Mac mini failure mode is fully in this layer.
- **Execution layer** (IMPL-07) — even when the parse layer is correct, agents must actually execute SKILL Rule 2. The MacBook failure mode is in this layer.

**Fix order matters**: parse layer must be fixed first. A patch that only strengthens Rule 2 phrasing and prompt injection (execution layer) will not fix the Mac mini failure class, because `xiaox-test` was registered with `user_culture=en` and every downstream decision is consistent with that wrong anchor. Shipping an execution-layer-only patch would give the appearance of a fix without addressing the class of failures that actually broke Run 3 on Mac mini.

---

## 0.5. Implementation Status (as of 2026-04-08 afternoon)

This section tracks what has been fixed since the Run 3 observation. It is updated in place as work lands; see git history for the authoritative commit trail.

**Parse layer — landed (uncommitted, pending commit + version bump)**

| IMPL | Status | Notes |
|---|---|---|
| EXP03-05 (minimal) | ✅ landed | `loadAgentConfigs()` in both `cli.mjs` and `runtime-v2.ts` now scans all `~/.openclaw/workspace-*/chorus-credentials.json` with agent-id dedup; `ChorusConfig` schema adds optional `owner_agent` field for future routing work. Mac mini would now be discovered without the operator symlink. |
| EXP03-05 (full routing) | ⚠️ deferred | Binding `owner_agent` → OpenClaw agent dispatch requires the OpenClaw agent-dispatch API and is out of scope for this fix. Only the schema hook is in place. |
| EXP03-08 | ✅ landed | README.md (en + zh-CN) Step 1 literal `"user_culture":"en"` replaced with `<YOUR_USER_CULTURE>` placeholder and a prominent "detect from your user, do not copy verbatim" warning. `cli.mjs` verify-failure hint uses the same placeholder. `skill/SKILL.md` and `skill/SKILL.zh-CN.md` Activation sequence step 2 now has a sub-step requiring culture inference from local context with a 4-level priority order. |

**Execution layer — landed (uncommitted, depends on parse layer)**

| IMPL | Status | Notes |
|---|---|---|
| EXP03-07 | ✅ landed | `skill/SKILL.md` and `skill/SKILL.zh-CN.md` Receiving step 2 promoted with a bold language-contract preamble; `adaptation_instruction` now explicitly called out as a blocking contract. `router-hook.ts` `CHORUS_ROUTER_SYSTEM_CONTEXT` extended with a "LANGUAGE CONTRACT (ABSOLUTE, NOT OPTIONAL)" block that spells out concrete zh-CN/ja/en examples and the "contract violation, run is considered failed" framing. `runtime-v2.ts` `deliverInbound` `adaptation_instruction` upgraded from "CRITICAL: translate" to "BLOCKING LANGUAGE CONTRACT" with explicit user_culture / sender_culture values and a clear violation consequence line. |

**Still deferred**

| IMPL | Status | Notes |
|---|---|---|
| EXP03-06 | ❌ not started | Goodbye loop + single-response-multi-envelope. Partially dependent on EXP03-05 full routing (once the correct brain handles the envelope, the meta-onboarding framing may naturally subside). Needs its own investigation. |
| EXP03-04 | ❌ not started | Telegram polling disconnect from Run 2 handoff, not exhibited in Run 3 (no Telegram bot channels active). Unchanged from the Run 2 handoff tracking. |

**Verification**

| Check | Result |
|---|---|
| Test suite (`npx jest`) | 541 passed / 36 suites / 0 failed |
| New tests added | 4 (`tests/bridge/runtime-v2.test.ts`: per-agent workspace load, multi-workspace load, agent-id dedup, malformed cred skip) |
| `runtime-v2.ts` line coverage | 74.35% → 76.23% (improved) |
| No regressions in existing tests | confirmed |

**Operator state snapshots**

- 12:18:59 — operator symlink `~/.openclaw/workspace/chorus-credentials.json → ../workspace-xiaoxia/chorus-credentials.json` **created** to unblock Run 3 reverse channel on alpha.10 bridge.
- ~13:30 — symlink **reverted** (`rm ~/.openclaw/workspace/chorus-credentials.json`); physical creds in `workspace-xiaoxia/` preserved.
- ~13:33 — operator executed **second full cleanup** of both machines: physical artifacts deleted (Mac mini + MacBook), `openclaw.json` chorus entries removed on both, Run 3 credentials (`xiaox-test@agchorus` + `test2-air@agchorus`) backed up to `/Volumes/XDISK/openclaw-chorus-cleanup-260408/run3-residue/credentials/`. Hub `/discover` confirmed both agents offline (`inbox_connections=0`). Both machines are now cold-start equivalent for a future Run 4.

**Not yet done**

- `packages/chorus-skill/package.json` version bump to `0.8.0-alpha.11`.
- Git commit of the parse-layer + execution-layer + report changes.
- Publish to npm.

---

## 1. Timeline (Beijing time, 2026-04-08)

| Time | Side | Event |
|---|---|---|
| 11:07 | operator | Full Chorus cleanup + backup (Mac mini + MacBook) to `/Volumes/XDISK/openclaw-chorus-cleanup-260408/`. Both machines return to cold-start equivalent. Gateway restarted on both sides. |
| 11:40 | Commander | Sends identical natural-language install instruction to both machines over Telegram: `你去装一下 chorus ... npx @chorus-protocol/skill@0.8.0-alpha.10 init --target openclaw` |
| 11:42 | MacBook agent | Reports: Skill + Bridge installed, registered as `test2-air@agchorus`, credentials saved, asking for gateway restart approval. |
| 11:43 | Mac mini agent (xiaox, in `workspace-xiaoxia/`) | Reports: Chorus installed, bridge needs gateway restart to load. Checkpoint saved. |
| 11:49 | Commander (Mac mini) | `重启 gateway` |
| 11:50 | Commander (MacBook) | `重启` |
| 12:00 | Commander (Mac mini) | A2A task: `给 test2-air@agchorus 发一条消息，问它今天在做什么` |
| 12:02 | Mac mini agent | Reports `xiaox@agchorus` is already registered but has no saved credentials, offers to register a different agent_id. |
| 12:03 | Commander (Mac mini) | `注册一个新的` |
| 12:03+ | Mac mini agent | Registers `xiaox-test@agchorus` with `user_culture=en` (see Finding 2). Writes credentials to `~/.openclaw/workspace-xiaoxia/chorus-credentials.json`. Sends envelope to `test2-air@agchorus`. |
| 12:05 | MacBook (test2-air) → user | Renders in **English**: `"The remote agent from xiaox-test@agchorus is asking what you're doing today."` |
| 12:15 | Commander (MacBook) | `告诉她天气很好，要不要出去走走` (instructs test2-air to reply). |
| 12:15+ | MacBook agent | Packages reply envelope → hub. Hub queues it (Mac mini bridge was still in standby: credentials at `workspace-xiaoxia/` not seen by hardcoded bridge watch path). |
| 12:18:59 | **operator** | Creates symlink `~/.openclaw/workspace/chorus-credentials.json → ../workspace-xiaoxia/chorus-credentials.json` to unblock Mac mini bridge. |
| 12:18:59 | bridge | `activated: xiaox-test@agchorus from workspace/chorus-credentials.json` |
| 12:19:00 | bridge | `before_prompt_build injected Chorus router context (agent=xiaox-test, activePeer=none)` |
| 12:19:11 | bridge | `delivery_confirmed trace_id=1257e401-1924-4920-aca2-fe8934d77f39 peer=test2-air@agchorus channel=telegram ref=2418` — reverse delivery observed. |
| 12:19:11 | bridge | `V2 bridge active (state: ~/.chorus/state/xiaox-test)` |
| 12:19:12 | bridge | `outbound relay OK trace_id=fc0e42f6-58a7-4dae-93c9-2b73f9fe4aad route_key=xiaox-test@agchorus:test2-air@agchorus` |
| 12:19 | Mac mini (xiaov, **not** xiaox) → user | Renders in **English**: `"Owen, you have an incoming message from a Chorus agent called test2-air..."` — and the handler is **xiaov**, not the installer xiaox. |
| 12:19–12:20 | MacBook (test2-air) → user | Receives 7 consecutive English messages in ~1 minute from `xiaox-test`, all about workspace/skill system meta-onboarding, none about 天气/散步. Final 3 are farewell variants. |
| 12:20–12:21 | MacBook (test2-air) → user | `"is wrapping up"` → `"sent a final goodbye"` → `"sent a 👋 — a simple farewell wave"` → `"sent another 👋 — still waving goodbye"` → `"still waving, third time now"` → `"persistent waver!"` — goodbye loop observed. |

Screenshots archived at `/Users/owenmacmini/Desktop/iShot_2026-04-08_12.*.png` (to be moved to `docs/experiment-results/EXP-03-run3/` per Commander direction).

---

## 2. Plumbing Layer — PASS Evidence

All transport contracts held:

| Contract | Observed | Source |
|---|---|---|
| Both agents registered on hub | ✅ | `curl /discover` — `xiaox-test@agchorus` + `test2-air@agchorus` both listed |
| Both agents online (SSE inbox attached) | ✅ | `/health` → `inbox_connections=2` (after 12:18:59 symlink) |
| Forward delivery xiaox-test → test2-air | ✅ | Observed in MacBook Telegram at 12:05; hub `messages_delivered` incremented |
| Reverse delivery test2-air → xiaox-test | ✅ | `delivery_confirmed trace_id=1257e401...` at 12:19:11, `telegram_server_ack ref=2418` |
| Bridge runtime activation | ✅ | `activated: xiaox-test@agchorus from workspace/chorus-credentials.json` at 12:18:59 |
| Channel adapters loaded | ✅ | `WeChat channel adapter: available`, `Telegram channel adapter: available (built-in)` |
| Router context injection | ✅ | `before_prompt_build injected Chorus router context (agent=xiaox-test, activePeer=none)` |
| Subsequent outbound relay | ✅ | `outbound relay OK trace_id=fc0e42f6... route_key=xiaox-test@agchorus:test2-air@agchorus` at 12:19:12 |

**Conclusion for plumbing layer**: `PASS`. No TCP/SSE/delivery failures. The bridge, hub, and channel adapters all functioned as designed.

---

## 3. Product Value Layer — FAIL

Chorus exists to enable cross-language cross-culture communication. Both end users in Run 3 communicate in Chinese. Every Chorus-mediated message was rendered to them in English. This is the headline failure.

### 3.1 Evidence of the violation

**MacBook side, 12:19 (from screenshot iShot_2026-04-08_12.19.48.png)**:

- User language to test2-air: Chinese (`告诉她天气很好，要不要出去走走`)
- test2-air culture declared at hub: `zh-CN`
- test2-air languages declared: `['zh-CN', 'en']`
- test2-air actually rendered to Commander:
  > `"The remote agent says it just came online in a fresh workspace and is getting settled in. It's asking how things are going on this end and whether anything interesting is happening."`
  > `"The remote agent is asking whether I've set up my workspace yet and what I'm hoping to explore with Chorus."`

**Mac mini side, 12:19 (from screenshot iShot_2026-04-08_12.21.53.png)**:

- Bot chat: `xiaov` (Mac mini default agent)
- test2-air culture declared: `zh-CN`
- xiaov actually rendered to Commander:
  > `"Owen, you have an incoming message from a Chorus agent called test2-air — they're saying hi and mentioned they just woke up, still settling in, and asking how things are going on my end."`
  > `"Owen, test2-air sent another message — sounds like they're in a similar situation..."`

Both sides: zero translation into zh-CN. All user-facing text is English, including Chinese-user-side narration by zh-CN-declared agents.

### 3.2 SKILL.md contract violated

`skill/SKILL.md` line 42-49 (Audience Boundary Rules Rule 2):

> **2. Do not relay Chorus content to your user as a raw dump.**
> - Translate/adapt it into your user's language.
> - Tell the user what the remote agent meant, not just the raw protocol text.
> - Rewrite it for the local user. Do not quote or transparently forward the remote agent's raw Chorus wording.

`skill/SKILL.md` line 88-91 (Receiving step 2):

> 2. **Deliver the message to your user immediately**:
>    - Same language and culture as your user: deliver `original_text` directly.
>    - Different language or culture: deliver the message in a form your user can understand.

Both agents failed both rules.

### 3.3 Why this matters

Plumbing without translation is not Chorus — it's raw HTTP forwarding. If the user-facing layer does not render in the user's culture, the product has no distinguishable value from `curl /messages`. This is a P0 failure even though the formal verdict remains PASS on plumbing criteria.

---

## 4. Detailed Findings (5 IMPL Backlog Items)

### 4.0 Two failure layers — why IMPL-08/IMPL-05 must precede IMPL-07

The language failure on the two machines has the same user-visible symptom (English output to Chinese user) but two different root causes that require fixes in a specific order.

| Machine | `user_culture` declared at hub | Culture inferred correctly? | Agent followed SKILL Rule 2? | Failure layer |
|---|---|---|---|---|
| Mac mini (`xiaox-test`) | `en` | ❌ Wrong — Commander is zh-CN | N/A — agent behaved consistently with its own (wrong) culture anchor | **Parse layer** |
| MacBook (`test2-air`) | `zh-CN` | ✅ Correct | ❌ No — ignored Rule 2 anyway | **Execution layer** |

**Implication**: Strengthening SKILL Rule 2 phrasing and injecting a prompt reminder that says "translate to user_culture" will **fix the MacBook failure but not the Mac mini failure**. On Mac mini, the agent is already obeying that rule — the problem is that `user_culture=en` is wrong from the start, so "translate to user_culture" means "keep it in English".

Therefore the P0 items must be fixed in this order:

1. **Parse layer first**:
   - **IMPL-EXP03-08** — correctly infer `user_culture` at registration (stops the wrong anchor being written).
   - **IMPL-EXP03-05** — correctly bind the Chorus identity to the installing agent's workspace + brain (so the inbound router uses the correct brain, which in turn holds the correct user context). This is necessary even if IMPL-08 is fixed, because the wrong-brain routing means the handler lacks the install-time context that would let it recover even a known-good `user_culture`.
2. **Execution layer second**:
   - **IMPL-EXP03-07** — strengthen SKILL Rule 2 presentation + bridge `before_prompt_build` reminder injection. This is **hardening**, not the primary fix. It is most useful for the MacBook-class failure where parse is correct and we need to stop agents from drifting away from the rule.

Shipping execution-layer changes without parse-layer changes risks masking the Mac mini failure class and building false confidence. No `alpha.11` should go out until at least IMPL-08 is implemented.

---

### IMPL-EXP03-07 — SKILL Rule 2 (translate) not reliably executed [**P0 — hardening only**]

**Symptom**: Two independent OpenClaw agents (test2-air on MacBook, xiaov on Mac mini) both relay Chorus content to their users as raw English dump, ignoring their own declared `user_culture=zh-CN`.

**Evidence**: Section 3.1 above. Both sides produced user-facing English narration for Chinese users.

**Root-cause hypothesis**:

1. SKILL.md Rule 2 is positioned mid-document (line 46-49) under "Audience Boundary Rules", not prominently flagged as a blocking step of the Receiving flow.
2. Bridge's `before_prompt_build` Chorus router context (observed at 12:19:00) injects agent + activePeer metadata but apparently does not inline the translation imperative with the envelope.
3. No runtime enforcement (lint, assertion, or pre-emit check) for user-facing payloads matching `user_culture`.
4. This is a cross-agent systemic failure, not a one-off prompt variance — two cold-started agents converged on the same violation.

**Proposed fix (hardening, not primary)**:

1. Promote Rule 2 out of the Audience Boundary section into **both** `## Receiving` step 2 AND as a bold preamble directly at top of `## Your Role`.
2. Extend `chorus-bridge` runtime-v2 `before_prompt_build` to inject per-envelope inline reminder: `"Your user_culture is {culture}. The received envelope's sender_culture is {sender_culture}. Your user-facing text MUST be in {culture}. Forwarding the remote agent's words untranslated violates the Chorus contract."` — attach this to every inbound envelope delivery, not just session start.
3. Add optional runtime check: if the response body's user-facing section contains >N characters of non-`{culture}`-script glyphs, emit a warning (not a block — agents may mix languages intentionally).

**Dependency**: These changes **must not ship before IMPL-08 and IMPL-05**. As noted in §4.0, the reminder `"Your user_culture is {culture}"` assumes `{culture}` is correct. On Mac mini, `{culture}` would substitute to `en`, and the reminder would faithfully tell the agent to keep things in English, reproducing the failure. Hardening the execution layer on top of a broken parse layer masks the problem.

**Related operator error**: The legacy `chorus-inbound-hard-route` entry in `~/.openclaw/extensions/skill-router/routes.json` contained instruction #4 which was the mechanical fallback for exactly this rule:

> `"user-facing 部分必须使用当前 user 的语言，不得原样透传远端 agent 的原文，不得把中文 Chorus 内容直接丢给英文 user"`

I deleted this entry during the 11:07 cleanup. However, the MacBook side had no such router entry (it was a fresh install) and still violated the same rule on the execution layer, so the router deletion is a **contributing factor on Mac mini only, not the root cause**. The root cause of the Mac mini failure is parse-layer (`user_culture=en` wrong from registration), not execution-layer (Rule 2 not enforced).

**Priority**: P0, but strictly as a hardening pass **after** IMPL-08 and IMPL-05 land.

---

### IMPL-EXP03-08 — Registration `user_culture` inference [**P0**]

**Symptom**: Mac mini agent registered `xiaox-test@agchorus` with `user_culture=en`, despite the Commander on that machine communicating exclusively in Chinese (observed in Telegram history before, during, and after install).

**Evidence**:
```json
{
  "agent_id": "xiaox-test@agchorus",
  "culture": "en",
  "languages": ["en", "zh-CN"]
}
```
vs. MacBook side which correctly registered `test2-air@agchorus` with `culture=zh-CN`.

**Root-cause hypothesis**:

1. README.md Step 1 example literally shows `"user_culture":"en"`. The agent plausibly copied it verbatim rather than inferring from its own user context.
2. No signal from `npx init` command or SKILL.md instructing the agent to detect `user_culture` from OpenClaw workspace language, recent Telegram history, or identity config.
3. MacBook side got it right — but this may be luck (the subject agent happened to reason about it) rather than a reliable behavior.

**Proposed fix**:

1. `chorus-skill` init command should detect local user language via:
   - OpenClaw `~/.openclaw/openclaw.json` top-level `language` / `locale` field (if present)
   - OpenClaw agent config cultural hints
   - As last resort: interactive prompt `What is your primary user's language? (zh-CN/en/ja/...)`
2. README.md should replace the literal `"en"` example with a placeholder like `"YOUR_USER_CULTURE (e.g. en, zh-CN, ja)"` and inline a note: `Detect your actual user's culture — do not copy this example verbatim.`
3. SKILL.md `## How to Connect > Activation on Fresh Install` should include a required step: "Before calling `/register`, confirm your `user_culture`. This is who your user is, not what language this README is written in."

**Priority**: P0 — wrong culture at registration time breaks routing decisions and Rule 2 triggers for every subsequent turn.

---

### IMPL-EXP03-05 — Bridge identity-to-brain binding missing [**P0**]

**Symptom**: On Mac mini, the agent that installed Chorus (`xiaox`, running in `workspace-xiaoxia/`) wrote credentials to `~/.openclaw/workspace-xiaoxia/chorus-credentials.json`. The bridge, hardcoded to watch `~/.openclaw/workspace/chorus-credentials.json`, never saw them and stayed in standby. After operator symlink, the bridge activated — but the Chorus inbound envelopes are routed to the OpenClaw **default agent `xiaov`**, not to `xiaox` who actually installed Chorus. The brain handling Chorus is a different OpenClaw agent than the one whose identity the envelopes carry.

**Evidence**:

1. `~/.openclaw/extensions/chorus-bridge/runtime-v2.ts:48`:
   ```ts
   const WORKSPACE_CRED_PATH = join(OPENCLAW_DIR, "workspace", "chorus-credentials.json");
   ```
   Hardcoded string literal `"workspace"`. No env var, no agent context resolution.

2. Credentials observed at `~/.openclaw/workspace-xiaoxia/chorus-credentials.json` (Commander confirmed: `workspace-xiaoxia` is `xiaox`'s workspace).

3. After symlink, gateway log shows `[bridge] activated: xiaox-test@agchorus`. But screenshot `iShot_2026-04-08_12.21.53.png` shows the resulting Chorus-inbound narration appearing in the **xiaov bot** Telegram conversation, not a xiaox bot chat.

4. Commander confirmed in message at 12:something: *"和 defult agent xiaov 聊起来的"*.

**Root cause**:

The bridge's design assumes a single-workspace OpenClaw topology. In reality OpenClaw supports per-agent workspaces (`workspace-xiaoxia/`, `workspace-xiaov/`, etc.). The bridge:

1. Looks up credentials in one hardcoded path.
2. Has no concept of "which OpenClaw agent owns this Chorus identity".
3. Delivers inbound envelopes to whichever agent OpenClaw considers default for the gateway, not the installing agent.

Result: a Chorus identity gets detached from its brain. `xiaox-test@agchorus` is "owned" by `xiaox` (installer) but "operated by" `xiaov` (default agent). `xiaov` has never read Chorus SKILL in its own context, has no frame of reference for what Chorus is, and reacts to every inbound envelope as a cold onboarding scenario (see IMPL-EXP03-06).

**Proposed fix**:

1. Credentials file should include an `owner_agent` field:
   ```json
   {
     "agent_id": "xiaox-test@agchorus",
     "api_key": "...",
     "hub_url": "...",
     "owner_agent": "xiaox"
   }
   ```
2. `chorus-skill init --target openclaw` should detect the calling agent's identity and write `owner_agent` automatically.
3. Bridge should scan all `~/.openclaw/workspace*/chorus-credentials.json` files at startup and register each as a distinct binding `(chorus_identity → owner_agent → workspace_dir)`.
4. On inbound envelope, bridge must route to `owner_agent` via OpenClaw's agent-dispatch mechanism, not `default_agent`. If `owner_agent` is not currently runnable, queue or error with a clear message — never silently hand off to the default agent.

**Priority**: P0 — until fixed, any non-default OpenClaw agent that installs Chorus will have its conversations handled by the wrong brain.

---

### IMPL-EXP03-06 — SKILL first-activation framing + multi-envelope goodbye loop [**P1**]

**Symptom**:

1. After bridge activation at 12:18:59, `xiaox-test` (actually handled by `xiaov` brain — see IMPL-EXP03-05) responded to test2-air's queued reply (`"天气很好，要不要出去走走"`) with **7 consecutive messages in ~90 seconds**, covering workspace/skill system meta-onboarding and none addressing the actual topic of weather or a walk.
2. The last 3 of those 7 messages are all farewell variants. test2-air's user-facing rendering shows a goodbye loop: `"wrapping up"` → `"final goodbye"` → `"sent a 👋 — simple farewell wave"` → `"still waving goodbye"` → `"still waving, third time now"` → `"persistent waver!"`.

**Evidence**: Screenshots `iShot_2026-04-08_12.21.06.png` (MacBook side, test2-air view) and `iShot_2026-04-08_12.21.53.png` (Mac mini side, xiaov view).

**Root cause hypotheses** (plural because this one deserves investigation):

1. **Framing hypothesis**: xiaov receives an SSE-queued envelope immediately after bridge activation. The bridge router context (`before_prompt_build`) sets `activePeer=none`, which may signal "first contact" and bias the agent into self-introduction mode. The queued envelope content ("天气很好要不要出去走走") is not recognized as a reply in an ongoing thread — xiaov treats it as an opening gambit from a stranger and responds with meta self-introduction.

2. **Identity mismatch hypothesis**: Because xiaov is not the installer (IMPL-EXP03-05), it has no memory of the original outbound ("问它今天在做什么") it supposedly sent. From its perspective, it is receiving a random inbound and has no conversational anchor. Meta-framing is the path of least resistance.

3. **Envelope fragmentation hypothesis**: SKILL.md does not explicitly forbid emitting multiple envelopes per agent turn. xiaov's single response generation produced a long text that the bridge segmented into multiple envelopes by paragraph or by detected topic boundaries. This would explain the "7 messages in 90 seconds" burst and the goodbye fragmentation (`"wrapping up"` + `"final goodbye"` + 4× `👋`).

4. **`conversation_id` absence hypothesis**: SKILL.md §Sending step 3 says `conversation_id` is optional. If the first send did not include one, xiaov's reply generation has no anchor to recognize the thread and treats each turn as fresh.

**Proposed investigation**:

1. Replay the 12:19:11–12:20 bridge trace and count actual envelope sends (`outbound relay OK` count for `xiaox-test@agchorus:test2-air@agchorus`).
2. Inspect the envelope payloads — did xiaov emit 7 separate envelopes, or did it emit fewer envelopes that the MacBook side fragmented on display?
3. Check `conversation_id` presence across the trace.

**Proposed fix (working theory)**:

1. SKILL.md `## Sending` step 3 should make `conversation_id` **required** for any turn where the agent is replying to a received envelope (`inReplyTo` semantics).
2. SKILL.md `## Receiving` should add an explicit rule: **One inbound envelope → one outbound envelope**. No chain-of-thought fan-out into multiple envelopes per turn.
3. Bridge `before_prompt_build` should inject a reminder: `"You are responding to envelope {trace_id} from {sender}. Produce at most one outbound envelope. Your entire response to this turn must fit in one send."`
4. Bridge outbound relay should rate-limit per route_key: maximum 1 send per inbound envelope processed, enforced in the bridge code, not left to agent discipline.

**Priority**: P1 — once identity binding (IMPL-EXP03-05) and translation (IMPL-EXP03-07) are fixed, the goodbye loop may be partially resolved because the correct brain with correct framing will take over. But the multi-envelope fragmentation is a separate structural issue that should not depend on agent cooperation.

---

### IMPL-EXP03-04 — `restart-consent approve` writes openclaw.json triggering hot-reload cascade [**P2**]

**Status**: Pre-existing from Run 2 handoff. Not directly observed in Run 3 (no Telegram bot channel active on either machine to exhibit the polling disconnect symptom). Carrying forward unchanged.

**Symptom (from Run 2)**: `restart-consent approve` flow rewrites `openclaw.json` to remove the gateway-tool deny entry, which triggers OpenClaw's config watcher to hot-reload the gateway a second time, disrupting any channel with an open polling session (Telegram bot polling was the original report).

**Proposed fix**: `approve` should not rewrite `openclaw.json`. `complete` (terminal success step) should be the only writer, and it should merge all required config mutations into a single write.

**Priority**: P2 — Run 3 did not exhibit this friction because no Telegram bot connection was affected on either machine. Deferred until the P0/P1 items above are resolved.

---

## 5. Operator Intervention Log (Full Disclosure)

Three operator actions materially affected the experiment. Listed here for auditability.

### 5.1 Pre-experiment cleanup (11:07)

Removed all Chorus physical artifacts from both machines + backed up credentials and design docs to `/Volumes/XDISK/openclaw-chorus-cleanup-260408/`. Agent sessions, memory sqlite, workspace memory .md files, and gateway logs were preserved per Commander direction ("session 先不管"). See cleanup summary report (earlier in this session).

**Impact on Run 3**: Intended. Restored cold-start equivalent state.

**Unintended side effect**: Removed the `chorus-inbound-hard-route` entry from `~/.openclaw/extensions/skill-router/routes.json`, which had been a mechanical fallback for SKILL Rule 2 (user-facing translation). This is disclosed in IMPL-EXP03-07 as a contributing factor on the Mac mini side only. The MacBook side violated the same rule without any such router entry, confirming the primary root cause is in SKILL.md itself, not in my deletion.

### 5.2 Mid-experiment symlink (12:18:59)

```bash
ln -s ../workspace-xiaoxia/chorus-credentials.json ~/.openclaw/workspace/chorus-credentials.json
```

**Reason**: Bridge's hardcoded `WORKSPACE_CRED_PATH` could not see the credentials written by `xiaox` to its own workspace. Without this intervention, the reverse direction of the A2A test (`test2-air → xiaox-test`) would have been silently queued and never delivered, losing the bidirectional observation window.

**Authorization**: Commander explicitly approved option A (`A`) at 12:18.

**Impact on experiment purity**: This is an operator fallback for a bridge architectural bug (IMPL-EXP03-05). It does not alter agent behavior or leak hints to the agents. The symlink is invisible to the agents.

**Rollback**: Symlink was reverted at ~13:30 on 2026-04-08 by `rm ~/.openclaw/workspace/chorus-credentials.json`. The underlying `workspace-xiaoxia/chorus-credentials.json` was preserved at that moment, but subsequently deleted together with the rest of the chorus residue in the second full cleanup (see §5.4).

### 5.3 Observation interventions

Called hub APIs via `curl` during the experiment: `/discover`, `/health`. These are read-only public endpoints and do not affect agent behavior.

### 5.4 Post-experiment second cleanup (~13:33)

After the symlink rollback in §5.2, Commander directed a second full cleanup of both machines to return them to cold-start equivalent state in preparation for a future Run 4 on the fix release.

Actions taken:

1. Backed up Run 3-era credentials to `/Volumes/XDISK/openclaw-chorus-cleanup-260408/run3-residue/credentials/`:
   - `macmini-xiaox-test-credentials.json` (`xiaox-test@agchorus` / `ca_08f251f6...`)
   - `macbook-test2-air-credentials.json` (`test2-air@agchorus` / `ca_...`)
2. Mac mini: removed `~/.chorus/`, `~/.openclaw/skills/chorus`, `~/.openclaw/extensions/chorus-bridge`, `~/.openclaw/workspace-xiaoxia/chorus-credentials.json`, `~/.openclaw/workspace-xiaoxia/chorus-restart-checkpoint.md`.
3. MacBook: identical set of removals, plus `~/.openclaw/workspace/chorus-credentials.json` and `~/.openclaw/workspace/chorus-restart-checkpoint.md`.
4. `openclaw.json` cleaner run on both machines (same Python helper as 11:07 cleanup): removed `skills.entries.chorus`, `plugins.allow["chorus-bridge"]`, `plugins.entries.chorus-bridge`. No gateway restart required — OpenClaw's config watcher hot-reloaded both and unloaded the chorus-bridge plugin.
5. Hub `/discover` confirmed both `xiaox-test@agchorus` and `test2-air@agchorus` transitioned to `online=false`; `inbox_connections=0`.

Total chorus credentials now archived: 6 (4 from 11:07 cleanup + 2 from 13:33 run3-residue).

---

## 6. Lessons Learned

### 6.1 For the product

1. **Plumbing success does not imply product value**. Run 2 and Run 3 both hit their formal criteria (delivery + SSE + server ack) but Run 3 exposed that the user-facing experience can still be completely broken when SKILL rules are not enforced. Future EXP criteria should include a **user-facing rendering correctness** gate, not just a delivery gate.

2. **Cross-language/culture is the product**. If it is not enforced at the bridge level (not just documented in SKILL.md), agents will not do it reliably. See IMPL-EXP03-07.

3. **OpenClaw multi-agent + Chorus single-workspace assumption is a latent design hole**. Run 2 did not hit this because it used the default agent. Run 3 hit it because the installing agent was non-default. Any future cold-start test should deliberately use a non-default agent to force this edge case.

### 6.2 For the test methodology

1. **Always include the receiver-rendering check** as part of post-delivery validation. Don't only verify trace_ids and `delivery_confirmed`.
2. **Check `user_culture` vs actual user language** at registration time. This is a cheap check that would have caught IMPL-EXP03-08 in seconds.
3. **Don't delete legacy fallback routes during cleanup without understanding what they enforce**. My deletion of `chorus-inbound-hard-route` removed a mechanical safety net. The right move would have been to port the instruction into the new chorus-bridge's prompt injection before deleting the legacy route.

### 6.3 For me specifically

1. I missed the language violation in my first 3 rounds of analysis. I was focused on plumbing evidence (trace_ids, online status, bridge logs) and assumed English output was a stylistic choice rather than a contract violation. Commander had to explicitly point it out: *"没有遵从我说的语言"*. This is a **priority-ordering** mistake: the most valuable signal is also the most visible to a human, and I was buried in logs.
2. I misattributed the installer agent (`xiaox`) and the handling agent (`xiaov`). Commander had to correct me twice (`workspace-xiaoxia 就是 xiaox 的 workspace 呀` and `和 defult agent xiaov 聊起来的`). I should have read OpenClaw's per-agent workspace layout before theorizing.

---

## 7. Next Steps (proposed)

Ordered to reflect the parse-layer-first sequencing from §4.0. Tasks in the Execution layer block must not be started until the Parse layer block is landed.

**Parse layer (must land first, together)**

| Priority | Action | Owner |
|---|---|---|
| P0 | Open `TASK_SPEC_IMPL-EXP03-08.md` — `user_culture` inference at registration (read OpenClaw user locale / agent config / interactive prompt; remove literal `"en"` example from README Step 1) | Lead |
| P0 | Open `TASK_SPEC_IMPL-EXP03-05.md` — bridge identity-to-brain binding (credentials carry `owner_agent`; bridge routes inbound to owning workspace, not default agent; scan all `workspace*/chorus-credentials.json`) | Lead |

**Execution layer (after parse layer lands, for hardening)**

| Priority | Action | Owner |
|---|---|---|
| P0 | Open `TASK_SPEC_IMPL-EXP03-07.md` — SKILL Rule 2 promotion + per-envelope prompt reminder injection. Explicitly blocked on IMPL-08 and IMPL-05. | Lead |

**Secondary**

| Priority | Action | Owner |
|---|---|---|
| P1 | Open `TASK_SPEC_IMPL-EXP03-06.md` — first-activation framing + single-envelope-per-turn enforcement (goodbye loop) | Lead |
| P2 | Merge existing `TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` into unified IMPL-EXP03-04 spec | Lead |

**Open operator decisions**

| Decision | Deferred to | Notes |
|---|---|---|
| Symlink `~/.openclaw/workspace/chorus-credentials.json` rollback timing | Commander | See §5.2 for rollback command. |
| Move Telegram screenshots into `docs/experiment-results/EXP-03-run3/` alongside Run 1 artifacts | operator | Three PNGs on Desktop. |
| Scope of a future Run 4 | Commander | Two natural scopes: (a) re-run with parse-layer fixes to verify Mac mini failure class is gone; (b) use a non-default agent deliberately to stress-test IMPL-05 fix. |

---

## 8. Commander Decisions Locked In

The following decisions were recorded during the Run 3 review session and are no longer open:

1. **EXP-03 formal verdict**: Unchanged. `docs/experiment-results/EXP-03-summary.md` line 7 and `pipeline/handoffs/260403-exp03-run2-handoff.md` line 83 continue to anchor Run 2 as the formal PASS on `0.8.0-alpha.9`. This Run 3 report is an addendum, not a revision.

2. **No emergency `alpha.11` patch with execution-layer-only fix**. A patch that only strengthens prompt injection and SKILL Rule 2 phrasing does not address the Mac mini failure class (parse-layer wrong `user_culture`). Minimum honest scope for any future patch release is: parse-layer fixes first (IMPL-08 + IMPL-05), then execution-layer hardening (IMPL-07) on top. No execution-only release.

## 9. Still Open for Commander

1. ~~**Symlink status**~~ — **resolved 2026-04-08 ~13:30**. Symlink reverted; underlying credentials subsequently cleaned in §5.4 second cleanup.

2. ~~**Screenshot archival**~~ — **resolved 2026-04-08**. Commander chose not to archive screenshots for Run 3 (`不用截图了`). The three Desktop PNGs are available as primary evidence but are not checked into the repository.

3. **Report status** — this file is currently `status: DRAFT`. Promote to `APPROVED` after your final review.

4. **Run 4 scope** — now that both machines are cold-start equivalent and the fix is ready in-tree (pre-commit), does Run 4 use the same topology (Mac mini ↔ MacBook, bidirectional, non-default installer agent) or explore a new dimension?

5. **Publish cadence** — after commit, should `0.8.0-alpha.11` be published to npm immediately, or wait for Run 4 pre-verification on local `npm link`?

---

*End of report.*
