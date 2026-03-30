<!-- Author: Commander -->

# Bridge Runtime Validation Monitor

> Scope: verify whether merged `main` Bridge v2 achieves the original runtime goal on real OpenClaw paths.
> Rule: `[x]` only when the named evidence file exists and matches the task acceptance.

## Task Board

| ID | Assignee | Blocker | Status | Evidence |
|---|---|---|---|---|
| V-00-01 | commander | None | [x] | `acceptance.md` delivery acceptance frozen |
| V-00-02 | commander | None | [x] | `acceptance.md` reply attribution acceptance frozen |
| V-00-03 | commander | None | [x] | `acceptance.md` smoke success table frozen |
| V-01-01 | be-ai-integrator | V-00-01 | [x] | `evidence/V-01-01-wechat-delivery.md` = NO |
| V-01-02 | be-ai-integrator | V-00-01 | [x] | `evidence/V-01-02-telegram-delivery.md` = NO |
| V-01-03 | be-ai-integrator | V-00-02 | [x] | `evidence/V-01-03-route-attribution.md` = YES |
| V-01-04 | be-ai-integrator | V-00-02 | [x] | `evidence/V-01-04-session-bleed.md` = NO |
| V-01-05 | be-ai-integrator | V-00-01 | [x] | `evidence/V-01-05-timeout-late-send.md` = YES |
| I-02-A-01 | be-domain-modeler | V-01-01,V-01-02 | [x] | `remediation/delivery-truth.md` |
| I-02-A-02 | be-domain-modeler | V-01-01,V-01-02 | [x] | `evidence/I-02-A-02-delivery-unverifiable-observability.md` |
| I-02-A-03 | be-domain-modeler | V-01-05 | [x] | `evidence/I-02-A-03-timeout-duplicate-safety.md` |
| I-02-B-01 | be-ai-integrator | V-01-03,V-01-04 | [ ] | `remediation/route-attribution.md` |
| S-03-01 | be-api-router | V-00-03 | [x] | `evidence/S-03-01-hub-boot.md` |
| S-03-02 | be-ai-integrator | S-03-01 | [x] | `evidence/S-03-02-bridge-boot.md` |
| S-03-03 | be-api-router | S-03-02 | [x] | `evidence/S-03-03-real-inbound.md` |
| S-03-04 | be-ai-integrator | S-03-03 | [x] | `evidence/S-03-04-local-route.md` |
| S-03-05 | be-ai-integrator | S-03-04,V-00-01 | [x] | `evidence/S-03-05-delivery-result.md` |
| S-03-06 | be-ai-integrator | S-03-05,V-00-02 | [x] | `evidence/S-03-06-outbound-bind.md` |
| S-03-07 | be-api-router | S-03-06 | [x] | `evidence/S-03-07-relay-accept.md` |
| S-03-08 | be-ai-integrator | S-03-05,V-00-03 | [x] | `evidence/S-03-08-host-timeout.md` |
| S-03-09 | be-api-router | S-03-02,V-00-03 | [x] | `evidence/S-03-09-hub-timeout.md` |
| S-03-10 | be-domain-modeler | S-03-07,S-03-09 | [x] | `evidence/S-03-10-restart-recovery.md` |
| S-03-11 | be-domain-modeler | S-03-10 | [x] | `evidence/S-03-11-burst-20.md` |
| S-03-12 | be-domain-modeler | S-03-11 | [x] | `evidence/S-03-12-burst-200.md` |
| P-04-01 | commander | all required | [ ] | `final-verdict.md` = PASS |
| P-04-02 | commander | all required | [x] | `final-verdict.md` = CONDITIONAL |
| P-04-03 | commander | all required | [ ] | `final-verdict.md` = FAIL |
| P0-01 | be-ai-integrator | P-04-02 | [x] | `evidence/P0-01-published-package-usability.md` = PASS |

## Current Launch Window

| Runnable Now | Reason |
|---|---|
| P0-01 closed | E2E content conversation PASS on published `0.8.0-alpha.1` (2026-03-30). Prior mutual exclusion resolved by bundled runtime. |

## Notes

- `I-02-B-01` is not triggered by current Phase 1 evidence because `V-01-03 = YES` and `V-01-04 = NO`.
- `S-03-02` passed on the live environment after gateway restart. The earlier isolated-profile failure remains archived in `evidence/S-03-02-bridge-boot-attempt.md`.
- `S-03-03` and `S-03-04` are proven by live trace `e433c860-1e7a-431c-b382-19385f1386ad`.
- `S-03-05` is now closed on the live path: the deployed plugin records `delivery-results/<trace>.json` plus a structured `[bridge:delivery]` log with `status = unverifiable`.
- `S-03-06` and `S-03-07` are now closed on trace `89ed4319-74fe-49c7-aeeb-30b8d6813343`: outbound relay bound to `xiaov@openclaw`, and Hub stored exactly one row for that trace.
- `S-03-08` is now closed on trace `1a35ccf9-1bba-45c3-9d1d-53d12d16c891`: injected host timeout downgraded to terminal `unverifiable`, emitted a structured signal, removed the inbox entry, and did not re-enter duplicate local delivery.
- `S-03-09` is now closed with live proof in `evidence/S-03-09-hub-timeout.md`: a one-shot `hub-catchup-timeout.json` injection targeted `xiaox`, forced catch-up failure at `fetchHistory`, logged `Recovery: Hub catchup attempt 1 failed`, then `V2 startup FAILED: ... cannot proceed to SSE`, while `xiaov` still reached `V2 bridge active`. After removing the injected timeout via one-shot consume and restarting, `xiaox` later returned to `V2 bridge active` at log line `7231`.
- `S-03-10` is now closed with live proof in `evidence/S-03-10-restart-recovery.md`: probe trace `5bbaca46-06c6-465d-bb6b-72284604bec8` first hit an injected pre-send transient failure on restart 1 and remained incomplete (`terminal_disposition = null`, `cursor_advanced = false`, no delivery result file), then restart 2 resumed the same fact once and completed it as `delivery_unverifiable`, advancing cursor to `last_completed_trace_id = 5bbaca46-06c6-465d-bb6b-72284604bec8`. The repo-side blocker for this proof was fixed by filtering recovery history on `receiver_id === agentId`, so `xiaov` no longer replays `xiaox`-addressed history as self-route inbound.
- `S-03-11` is now closed with live proof in `evidence/S-03-11-burst-20.md`: a 20-message burst from `xiaov@openclaw` to `xiaox@chorus` was accepted by Hub on traces `b775a0d4-70a3-40e4-9231-cd40f6789a9e` through `8fedfcd8-9a40-4caf-9af6-ed3909bf7f70`, then recovered via restart/catch-up into exactly 20 new inbound facts and 20 new confirmed relay records. Post-burst state moved from `inbound_facts=169 / relay_evidence=117 / cursor=5bbaca46...` to `inbound_facts=189 / relay_evidence=137 / cursor=8fedfcd8...`, continuity advanced to `last_inbound_turn = 1020` and `last_outbound_turn = 55`, and none of the burst traces appeared in `xiaov` state.
- `S-03-12` is now closed with live proof in `evidence/S-03-12-burst-200.md`: a real 200-message burst from `xiaov@openclaw` to `xiaox@chorus` was accepted `200/200`, then recovered via restart/catch-up into `200/200` burst inbound facts. Inbound pruning hit the `500` cap, evicted the oldest seeded finalized facts (`s0312-seed-finalized-000` through `009`), preserved the retryable sentinel `s0312-keep-retryable`, and left continuity intact. Relay pruning did not cross the cap naturally because the burst yielded only `62` additional relays, so relay-side pruning was forced on the same live state by adding old confirmed ballast and invoking `DurableStateManager.mutate((s) => s)` directly; that reduced relay state from `509` to `500` while preserving all sampled unconfirmed relays.
- Delivery into `xiaov` is still degraded by `reason=no_context_token`; this no longer blocks outbound relay acceptance proof, but it remains an active host-side limitation for reverse local delivery.
- Gate 2 installable-runtime cutover now has live boot proof in `evidence/G-02-runtime-v2-boot-proof.md`: after the `2026-03-25 18:52 +08:00` restart, the live plugin loaded both bridge agent configs, entered V2 recovery, emitted `V2 bridge active` on `xiaov`, and resumed durable-state activity on `xiaox`.
- Gate 3 continuity bootstrap is now closed with live proof in `evidence/G-03-continuity-bootstrap-live.md`: on real inbound trace `cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4`, a fresh `continuity[route_key]` for `xiaox@chorus:gate3probe-2026-03-25T11-14-03-076Z@chorus` existed before delivery/result and cursor advance, then the injected timeout produced terminal `unverifiable` plus cursor advancement afterward.
- Gate 4 main-session acceptance is now closed in `evidence/G-04-main-session-readback-and-continuation.md`. The live proof set now covers: durable-state readback on the main session, tool/manual-send fail-closed behavior at runtime, stable continuation binding to `route_key = xiaox@chorus:xiaov@openclaw` / `remote_peer = xiaov@openclaw`, and exact-body acceptance on confirmed trace `306d596a-569e-4cf6-a04b-94713e3f722f`. The confirmed durable-state row `cce73694-b0c1-449f-98ef-3633b5bbf39e` stores `reply_text = GATE4_EXACT_BODY_FINAL_2026-03-25T21-41-00+08 xiaox exact body final。`, which exactly matches the remote body requested after `告诉她：...`.
- The current live direct SSE path is still contract-broken for new inbound events: the runtime is receiving SSE events without `timestamp`, so direct live delivery falls into `Hub contract violation` and the Gate 3 proof had to use restart/catch-up replay of the same real inbound trace.
- Final verdict is now frozen as `CONDITIONAL` in `final-verdict.md`: merged `main` is operational and Phase 3 is complete, but acceptance is satisfied only under downgraded semantics (`delivery_unverifiable acceptable`, `session-level acceptable`), and the live direct SSE path still has the `timestamp` contract defect so burst proofs rely on restart/catch-up rather than clean direct SSE application.
