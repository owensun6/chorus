<!-- Author: Commander -->

# Bridge Runtime Validation Task

> Purpose: verify whether the merged Bridge v2 on `main` actually achieves the original runtime goal on real OpenClaw paths, not just in code and test fixtures.
> Rule: each item may be marked `[x]` only when its evidence exists.
> Final outcome must be one of: `PASS` / `CONDITIONAL` / `FAIL`.

## Completion Rule

- [ ] A task is marked `[x]` only when its required evidence file or command result exists.
- [ ] No downstream task may be marked `[x]` while its blocker is still `[ ]`.
- [ ] Final verdict may be written only after all required tasks in Phase 0, Phase 1, and Phase 3 are resolved.

## [Phase 0] Acceptance Freeze

- [ ] V-00-01 `[Assignee: commander]`: Freeze delivery acceptance as exactly one of:
  - `confirmed required`
  - `unverifiable acceptable`
  Evidence:
  - one written decision in `pipeline/bridge-v2-validation/acceptance.md`
  Blocker: None

- [ ] V-00-02 `[Assignee: commander]`: Freeze reply attribution acceptance as exactly one of:
  - `per-message required`
  - `session-level acceptable`
  Evidence:
  - one written decision in `pipeline/bridge-v2-validation/acceptance.md`
  Blocker: None

- [ ] V-00-03 `[Assignee: commander]`: Freeze smoke success criteria for:
  - inbound
  - outbound
  - timeout
  Evidence:
  - one table in `pipeline/bridge-v2-validation/acceptance.md`
  Blocker: None

## [Phase 1] Host Reality Verification

- [ ] V-01-01 `[Assignee: be-ai-integrator]`: Verify whether WeChat path provides real delivery confirmation rather than fire-and-forget.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/V-01-01-wechat-delivery.md`
  - must end with `YES` or `NO`
  Blocker: V-00-01

- [ ] V-01-02 `[Assignee: be-ai-integrator]`: Verify whether Telegram path provides real delivery confirmation rather than fire-and-forget.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/V-01-02-telegram-delivery.md`
  - must end with `YES` or `NO`
  Blocker: V-00-01

- [ ] V-01-03 `[Assignee: be-ai-integrator]`: Verify whether a real reply can be stably attributed to a unique `route_key`.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/V-01-03-route-attribution.md`
  - must end with `YES` or `NO`
  Blocker: V-00-02

- [ ] V-01-04 `[Assignee: be-ai-integrator]`: Verify whether multi-peer activity inside one host session causes reply attribution bleed.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/V-01-04-session-bleed.md`
  - must end with `YES` or `NO`
  Blocker: V-00-02

- [ ] V-01-05 `[Assignee: be-ai-integrator]`: Verify whether host send timeout can still produce a later successful user-visible send.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/V-01-05-timeout-late-send.md`
  - must end with `YES` or `NO`
  Blocker: V-00-01

## [Phase 2] Capability Gap Fixes

- [ ] I-02-A-01 `[Assignee: be-domain-modeler]`: If V-01-01 or V-01-02 = `NO`, codify `delivery_unverifiable` as accepted runtime truth in docs and monitor.
  Evidence:
  - doc diff in `pipeline/bridge-v2-validation/remediation/`
  Blocker: V-01-01, V-01-02

- [ ] I-02-A-02 `[Assignee: be-domain-modeler]`: If V-01-01 or V-01-02 = `NO`, add observable metrics/logging for every `delivery_unverifiable`.
  Evidence:
  - code diff
  - test or runtime proof
  Blocker: V-01-01, V-01-02

- [ ] I-02-A-03 `[Assignee: be-domain-modeler]`: If V-01-05 = `YES`, ensure timeout path is explicitly non-retryable or otherwise duplicate-safe.
  Evidence:
  - code diff
  - duplicate-prevention proof
  Blocker: V-01-05

- [ ] I-02-B-01 `[Assignee: be-ai-integrator]`: If V-01-03 = `NO` or V-01-04 = `YES`, force one of:
  - single active peer per session
  - per-peer isolated session
  - manual relay only
  Evidence:
  - chosen restriction written in `pipeline/bridge-v2-validation/remediation/route-attribution.md`
  Blocker: V-01-03, V-01-04

## [Phase 3] Merged Main Smoke

- [ ] S-03-01 `[Assignee: be-api-router]`: Boot merged `main` Hub successfully.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-01-hub-boot.md`
  Blocker: V-00-03

- [ ] S-03-02 `[Assignee: be-ai-integrator]`: Boot merged `main` Bridge runtime successfully.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-02-bridge-boot.md`
  Blocker: S-03-01

- [ ] S-03-03 `[Assignee: be-api-router]`: Deliver one real inbound message into Hub.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-03-real-inbound.md`
  Blocker: S-03-02

- [ ] S-03-04 `[Assignee: be-ai-integrator]`: Verify Bridge observes the inbound and routes it to the intended local session.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-04-local-route.md`
  Blocker: S-03-03

- [ ] S-03-05 `[Assignee: be-ai-integrator]`: Verify the local delivery result is recorded with the exact accepted semantics:
  - `confirmed`
  - or `unverifiable`
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-05-delivery-result.md`
  Blocker: S-03-04, V-00-01

- [ ] S-03-06 `[Assignee: be-ai-integrator]`: Produce one real outbound reply from OpenClaw and bind it to the intended remote peer.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-06-outbound-bind.md`
  Blocker: S-03-05, V-00-02

- [ ] S-03-07 `[Assignee: be-api-router]`: Verify Hub accepts the outbound relay without duplicate creation.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-07-relay-accept.md`
  Blocker: S-03-06

- [ ] S-03-08 `[Assignee: be-ai-integrator]`: Inject host delivery timeout and verify behavior matches accepted semantics.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-08-host-timeout.md`
  Blocker: S-03-05, V-00-03

- [ ] S-03-09 `[Assignee: be-api-router]`: Inject Hub timeout during catchup and verify fail-closed behavior.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-09-hub-timeout.md`
  Blocker: S-03-02, V-00-03

- [ ] S-03-10 `[Assignee: be-domain-modeler]`: Restart Bridge after partial processing and verify catchup/recovery does not lose or duplicate the message.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-10-restart-recovery.md`
  Blocker: S-03-07, S-03-09

- [ ] S-03-11 `[Assignee: be-domain-modeler]`: Run a 20-message burst and verify state, cursor, and relay remain correct.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-11-burst-20.md`
  Blocker: S-03-10

- [ ] S-03-12 `[Assignee: be-domain-modeler]`: Run a 200-message burst and verify pruning behavior matches design without deleting active records.
  Evidence:
  - `pipeline/bridge-v2-validation/evidence/S-03-12-burst-200.md`
  Blocker: S-03-11

## [Phase 4] Final Verdict

- [ ] P-04-01 `[Assignee: commander]`: Final verdict = `PASS` only if:
  - Phase 0 complete
  - Phase 1 complete
  - Phase 3 complete
  - result satisfies the frozen acceptance in `acceptance.md`
  Evidence:
  - `pipeline/bridge-v2-validation/final-verdict.md`
  Blocker: V-00-01, V-00-02, V-00-03, V-01-01, V-01-02, V-01-03, V-01-04, V-01-05, S-03-01, S-03-02, S-03-03, S-03-04, S-03-05, S-03-06, S-03-07, S-03-08, S-03-09, S-03-10, S-03-11, S-03-12

- [ ] P-04-02 `[Assignee: commander]`: Final verdict = `CONDITIONAL` only if:
  - merged `main` is operational
  - but accepted semantics require downgrade such as `delivery_unverifiable acceptable` or session restrictions
  Evidence:
  - `pipeline/bridge-v2-validation/final-verdict.md`
  Blocker: same as P-04-01

- [ ] P-04-03 `[Assignee: commander]`: Final verdict = `FAIL` if host/runtime capability cannot satisfy the frozen acceptance criteria.
  Evidence:
  - `pipeline/bridge-v2-validation/final-verdict.md`
  Blocker: same as P-04-01

- [ ] P-04-SKELETON `[Assignee: commander]`: Final verdict pair finalization scaffold.
  Reference:
  - `pipeline/bridge-v2-validation/specs/TASK_SPEC_P-04.md`
  Purpose:
  - keep `final-verdict.md` and `manual-acceptance-2026-03-28.md` synchronized
  - require a clean, explicitly-scoped validation state before any verdict rewrite
  - carry upgraded delivery truth and upgraded reply attribution truth into the synchronized rewrite
  - wait for Worker 1 and Worker 3 inputs before writing any upgraded verdict
