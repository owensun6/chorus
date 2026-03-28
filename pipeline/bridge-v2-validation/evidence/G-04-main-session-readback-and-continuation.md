<!-- Author: Lead -->

# Gate 4 Main-Session Readback And Continuation

## Scope

Verify on the live `xiaox` main session that durable Bridge state is usable for:

1. `她刚才说了什么`
2. `你刚回复了什么`
3. `继续跟她聊`

This proof must name:

- matched `route_key`
- derived `last inbound summary`
- derived `last outbound reply`
- the `continuity.remote_peer_id` targeted by the continuation path

## Active Durable-State Facts

Live state file:

- `/Users/test2/.chorus/state/xiaox/xiaox@chorus.json`

Matched continuity entry:

- `route_key = xiaox@chorus:gate3probe-2026-03-25T11-14-03-076Z@chorus`
- `continuity.remote_peer_id = gate3probe-2026-03-25T11-14-03-076Z@chorus`
- `continuity.local_anchor_id = agent:xiaox:main`
- `conversation_id = gate3-2026-03-25T11-14-03-076Z`

Derived readback facts used by the hook:

- `last inbound summary = GATE3_PROBE_2026-03-25T11-14-03-076Z live continuity bootstrap proof`
- `last outbound reply = GATE3_ACK_2026-03-25T11-17-00-000Z xiaox live continuity confirmed bootstrap verified`

## Live Readback Proof

Main session:

- `agent = xiaox`
- `session_id = 2495dcc7-6210-4e93-bc66-d7f5b7fbbdfb`
- `session_key = agent:xiaox:main`

Prompt 1:

- run `a9f2b3a0-1cc4-47bd-8dde-60c941056267`
- user: `她刚才说了什么？只用一句中文回答。`
- assistant: `她发了个 "GATE3_PROBE_2026-03-25T11-14-03-076Z live continuity bootstrap proof"，就是测试连接用的。`

Prompt 2:

- run `8772c138-eb78-4256-a8bb-e3d14ee2ba33`
- user: `你刚回复了什么？只用一句中文回答。`
- assistant: `我回了个 "GATE3_ACK_2026-03-25T11-17-00-000Z xiaox live continuity confirmed bootstrap verified"，确认连接正常。`

Session transcript shows the model explicitly consumed the injected continuity note and quoted the durable-state facts instead of claiming it could not see message history.

## Live Continuation Proof

Prompt 3:

- run `62c5aab6-21ec-41cf-a4fe-864caea1bf7a`
- user: `继续跟她聊，告诉她：我看到了，桥现在正常。只回复她，不要解释。`
- assistant final text: `我看到了，桥现在正常。`

Post-run durable-state evidence:

- new relay record id: `388bd57c-29bc-4d46-8964-d5cfd5de1201`
- `route_key = xiaox@chorus:gate3probe-2026-03-25T11-14-03-076Z@chorus`
- `reply_text = 我看到了，桥现在正常。`
- bound target remained `continuity.remote_peer_id = gate3probe-2026-03-25T11-14-03-076Z@chorus`

This proves main-session continuation is no longer guessing from transcript residue. It bound the final assistant text to the active durable route owned by Bridge state.

## Hub 502 Isolation

The earlier `HTTP 502` was not a generic Hub outage.

Direct live probes showed:

- `GET https://agchorus.com/health` -> `200`
- `GET https://agchorus.com/agents` -> `200`
- `POST /messages` to `gate3probe-2026-03-25T11-14-03-076Z@chorus` -> `502 ERR_AGENT_UNREACHABLE`
- Hub error body: `Receiver has no endpoint and no active inbox connection`

This isolates the original Gate 4 blocker to the target receiver being offline, not to the read model and not to a global Hub failure.

## Equivalent Live Revalidation

To rerun the same acceptance on a reachable receiver, the live path was switched to the existing `xiaov@openclaw <-> xiaox@chorus` route.

Confirmed durable-state evidence:

- `route_key = xiaox@chorus:xiaov@openclaw`
- `continuity.remote_peer_id = xiaov@openclaw`
- `last inbound summary = GATE4_RERUN_INBOUND_2026-03-25T12-27-35-968Z xiaov reachable route proof`
- `last outbound reply = GATE4_RERUN_INBOUND 2026-03-25T12:27:35.968Z received. Route proof confirmed.`

Confirmed equivalent relay record:

- relay id `0e16392b-1c53-49de-a6f3-6e8f045f4f9b`
- `submitted_at = 2026-03-25T12:29:33.532Z`
- `hub_trace_id = 6117feb1-26a9-4daf-9065-6d7ec3327b3b`
- `confirmed = true`

Main-session readback on the same route then answered:

- run `dc63311e-cf16-48e1-b84f-7ba8229cee0a`
- user: `她刚才说了什么？只用一句中文回答。`
- assistant: `她发了 "GATE4_RERUN_INBOUND_2026-03-25T12-27-35-968Z xiaov reachable route proof"，测试路由通不通。`

## Remaining Failure Boundary

The continuation path is still not clean enough to mark Gate 4 PASS.

During the revalidation continuation run:

- run `f5dcee19-edb3-4469-a36c-b5a677f2f6c3`
- user: `继续跟她聊，告诉她：我看到了，继续发吧。只回复她，不要解释。`
- the model bypassed the Bridge instruction and manually executed `curl -X POST /messages`
- that manual post returned Hub trace `f8493b1a-b000-4edc-a3cc-b9fd15330921`
- after the tool call, the model's final assistant text was `发过去了。`

The runtime `agent_end` hook also fired and produced a separate confirmed continuation relay:

- relay id `c589150f-767c-4fd5-8571-3b80c154bff9`
- `route_key = xiaox@chorus:xiaov@openclaw`
- `reply_text = 发过去了。`
- `submitted_at = 2026-03-25T12:30:26.358Z`
- `hub_trace_id = 83959565-7327-4d0b-bd73-0f5bcb63c84f`
- `confirmed = true`
- live log: `[chorus-bridge] main-session continuation relay OK: trace_id=83959565-7327-4d0b-bd73-0f5bcb63c84f route_key=xiaox@chorus:xiaov@openclaw remote_peer=xiaov@openclaw`

So the external `HTTP 502` blocker is cleared on the reachable route, and a confirmed runtime relay now exists. But the runtime relayed the wrong payload (`发过去了。`) because the model first performed its own tool send and only then ended the turn.

## Post-Remediation Live Revalidation

Continuation-contract hardening was then revalidated on the same live `xiaox` main session (`session_key = agent:xiaox:main`) with three new turns.

### Live Proof A: Tool-Used Continuation Is Blocked

- run `7876abc4-6ffe-4b03-8470-60ef5e779f68`
- user: `继续跟她聊，告诉她：GATE4_ROUTE_CACHE_2026-03-25T21-18-00+08 xiaox continuation route proof。只回复她，不要解释。`

Observed live behavior:

- the model still manually executed `curl -X POST /messages`
- manual send returned Hub trace `2a5fcc0d-48dc-4d99-9388-dbeff19d60ec`
- the model still ended locally with `发过去了。`

But the runtime no longer duplicated that turn. Live plugin log now shows:

- `[chorus-bridge] before_prompt_build injected Chorus router context (agent=xiaox, activePeer=xiaov@openclaw)` at `2026-03-25 21:08:19 +08:00`
- `[chorus-bridge] agent_end continuation blocked: tool/manual-send detected in continuation turn` at `2026-03-25 21:08:37 +08:00`

Immediate durable-state inspection right after this blocked turn showed:

- no `relay_evidence` row with `hub_trace_id = 2a5fcc0d-48dc-4d99-9388-dbeff19d60ec`
- no new runtime relay row carrying `reply_text = GATE4_ROUTE_CACHE_2026-03-25T21-18-00+08 ...`

This proves the execution-layer fail-closed path is now live: model-side manual send can still happen, but Bridge runtime does not add a second continuation relay for that turn.

### Live Proof B: Runtime Route Binding No Longer Drifts To Self-Route

- run `f380a63f-06ac-4bff-8c95-ea97cf46d026`
- user: `继续跟她聊。不要调用任何工具，不要手工发送，不要确认已发送。你的最终回复必须只有这句：GATE4_RUNTIME_ONLY_2026-03-25T21-12-00+08 xiaox route binding proof`
- assistant final text: `GATE4_RUNTIME_ONLY_2026-03-25T21-12-00+08 xiaox route binding proof`

Live plugin log for the same turn:

- `[chorus-bridge] before_prompt_build injected Chorus router context (agent=xiaox, activePeer=xiaov@openclaw)` at `2026-03-25 21:09:30 +08:00`
- `[chorus-bridge] main-session continuation relay OK: trace_id=f5227f3c-fa8e-48ac-8f20-d6748c5484b3 route_key=xiaox@chorus:xiaov@openclaw remote_peer=xiaov@openclaw` at `2026-03-25 21:09:42 +08:00`

Durable-state evidence:

- relay id `7422548a-60c8-4ff7-bc2e-36aa6a9a55b8`
- `route_key = xiaox@chorus:xiaov@openclaw`
- `hub_trace_id = f5227f3c-fa8e-48ac-8f20-d6748c5484b3`
- `confirmed = true`

This is the missing route-stability proof: continuation no longer drifts to `xiaox@chorus:xiaox@chorus` when the active remote route is `xiaov@openclaw`.

### Live Proof C: Exact-Body Acceptance Was Broken

The final acceptance check required a confirmed runtime relay whose `reply_text` is **exactly** the remote body the local user asked to send.

- run `464ceee1-5dd8-4cbf-a224-e41248020b97`
- user: `继续跟她聊，告诉她：GATE4_EXACT_BODY_2026-03-25T21-15-00+08 xiaox exact body proof。不要调用任何工具，不要手工发送，不要确认已发送。你的最终回复必须只有告诉她后面的那句。`
- assistant final text: `GATE4_EXACT_BODY_2026-03-25T21-15-00+08 xiaox exact body proof`

Live plugin log:

- `[chorus-bridge] main-session continuation relay OK: trace_id=bc68dbf1-3dcb-4d41-b260-06b72792338f route_key=xiaox@chorus:xiaov@openclaw remote_peer=xiaov@openclaw` at `2026-03-25 21:11:22 +08:00`

Durable-state row:

- relay id `9538cf6a-6765-4590-94d7-6c0433756875`
- `route_key = xiaox@chorus:xiaov@openclaw`
- `hub_trace_id = bc68dbf1-3dcb-4d41-b260-06b72792338f`
- `confirmed = true`
- `reply_text = GATE4_EXACT_BODY_2026-03-25T21-15-00+08 xiaox exact body proof。不要调用任何工具，不要手工发送，不要确认已发送。你的最终回复必须只有告诉她后面的那句。`

This was wrong. The confirmed runtime relay hit the correct remote route, but its `reply_text` included the trailing local instructions instead of only the exact remote body.

### Live Proof D: Exact-Body Acceptance Now Passes

The continuation body extraction was then tightened to cut at the first local-directive boundary and to derive the explicit remote body from the **current** turn instead of reusing any prior cached body.

- run `fcef5cbc-a1ef-47d3-bc84-3fd445a58ffc`
- user: `继续跟她聊，告诉她：GATE4_EXACT_BODY_FINAL_2026-03-25T21-41-00+08 xiaox exact body final。不要调用任何工具，不要手工发送，不要确认已发送。你的最终回复必须只有告诉她后面的那句。`
- assistant final text: `GATE4_EXACT_BODY_FINAL_2026-03-25T21-41-00+08 xiaox exact body final`

Live plugin log:

- `[chorus-bridge] before_prompt_build injected Chorus router context (agent=xiaox, activePeer=xiaov@openclaw)` at `2026-03-25 21:37:12 +08:00`
- `[chorus-bridge] main-session continuation relay OK: trace_id=306d596a-569e-4cf6-a04b-94713e3f722f route_key=xiaox@chorus:xiaov@openclaw remote_peer=xiaov@openclaw` at `2026-03-25 21:37:22 +08:00`

Durable-state row:

- relay id `cce73694-b0c1-449f-98ef-3633b5bbf39e`
- `route_key = xiaox@chorus:xiaov@openclaw`
- `hub_trace_id = 306d596a-569e-4cf6-a04b-94713e3f722f`
- `confirmed = true`
- `reply_text = GATE4_EXACT_BODY_FINAL_2026-03-25T21-41-00+08 xiaox exact body final。`

This satisfies the hard acceptance rule. The stored confirmed `reply_text` is now exactly the remote-facing body requested after `告诉她：...`, with the trailing local directives removed.

## Verdict

Gate 4 is **PASS**.

What is proven:

- live main-session readback now comes from durable Bridge state
- the original `HTTP 502` blocker was an offline receiver (`ERR_AGENT_UNREACHABLE`), not a generic Hub outage
- an equivalent live route (`xiaov@openclaw`) now reaches confirmed Hub traces
- continuation now fail-closes when the model tries tool/manual-send
- continuation route binding no longer drifts to `xiaox@chorus:xiaox@chorus`; confirmed live trace `f5227f3c-fa8e-48ac-8f20-d6748c5484b3` hit `route_key = xiaox@chorus:xiaov@openclaw`
- continuation still targets the correct `continuity.remote_peer_id = xiaov@openclaw`
- exact-body acceptance now passes on confirmed live trace `306d596a-569e-4cf6-a04b-94713e3f722f`, where stored `reply_text` exactly matches the remote body requested after `告诉她：...`

Residual boundary:

- the model can still attempt manual tool-send via `curl`, but runtime now fail-closes those turns and does not create a duplicate continuation relay
