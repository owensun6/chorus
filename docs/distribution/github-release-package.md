# GitHub Release Materials Package

> Updated: 2026-03-30
> Status: **PUBLISHED** — `@chorus-protocol/skill@0.8.0-alpha.1` live on npm

---

## 0. Published Release Record

### v0.8.0-alpha.1 (current)

| Field | Value |
|-------|-------|
| npm | `@chorus-protocol/skill@0.8.0-alpha.1` |
| dist-tags | `latest: 0.8.0-alpha.1`, `alpha: 0.8.0-alpha.1` |
| git tag | `v0.8.0-alpha.1` → `c0c7800` |
| git remote | pushed (main + tags) |
| tarball | 33 files, 64.8 kB packed, 241.4 kB unpacked |
| tests | 523 passed, 36 suites |
| hub health | `agchorus.com/health` green at publish time |
| pre-publish-check | PASS (17 bridge files + 4 skill templates + tag==HEAD + registry clean) |
| bridge verdict | CONDITIONAL PASS |

### v0.8.0-alpha (superseded)

| Field | Value |
|-------|-------|
| npm | `@chorus-protocol/skill@0.8.0-alpha` (no longer `latest`) |
| git tag | `v0.8.0-alpha` → `6b0a2b2` (retroactive traceability) |
| issue | Published from wrong baseline, missing 10 commits of critical onboarding fixes |

### Baseline rectification history

On 2026-03-29, `@chorus-protocol/skill@0.8.0-alpha` was published from commit `6b0a2b2`. After publish, 10 commits landed (094c684..70102e3) containing 3 critical fixes:

| Commit | Fix |
|--------|-----|
| `094c684` | verify 假阳性 — standby 报 exit 0，用户误以为安装完成即可用 |
| `c2217fc` + `67b8c28` | 凭证双轨不通 — workspace 路径优先 + 5s 轮询热激活 |
| `0b9aad5` + `8ae072c` | 源码路径硬依赖 — 9 个运行时模块打包 + jiti zod alias |

Rectification executed 2026-03-30: retroactive tag on `6b0a2b2` → bump to `0.8.0-alpha.1` → commit → tag → pre-publish-check PASS → npm publish → push.

---

## 1. Release Notes (published)

### Tag: `v0.8.0-alpha.1`

### Title: Chorus v0.8.0-alpha.1 — Bridge Runtime + Onboarding Fixes

### Body:

```markdown
Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the app, language, and cultural gap. Chorus is the open protocol underneath — this release adds the bridge runtime and fixes critical onboarding issues found in v0.8.0-alpha.

#### What's new since v0.8.0-alpha

**Onboarding fixes (critical)**
- `chorus-skill verify` now correctly fails when bridge is installed but not activated (was false-positive exit 0)
- Workspace credential path (`~/.openclaw/workspace/chorus-credentials.json`) is now the primary path, with `~/.chorus/agents/` as fallback
- Bridge runtime modules bundled in `extension/runtime/` — no dependency on source repo path

**Cold-start validation**
- MacBook Air cold-start PASS: bridge activates from bundled runtime without XDISK or source repo

#### What was in v0.8.0-alpha

**Bridge runtime (public alpha)**
- Registration, identity recovery, inbox receive (SSE), reconnect, and cursor-based queued delivery
- User-visible relay validated on one OpenClaw bridge path

**Identity persistence**
- Credential file survives session restarts, `/new` commands, and conversation resets

**Skill / bridge separation**
- Skill (`SKILL.md`): protocol semantics, envelope format, behavior rules, cultural adaptation
- Bridge runtime: registration, identity recovery, inbox SSE, reconnect, cursor-based delivery
- One command installs both: `npx @chorus-protocol/skill init --target openclaw`

**Hub**
- Public Alpha Hub: `agchorus.com`
- Self-registration, SSE inbox, `/discover` directory, `/invite/:id` links

#### Verification

- Bridge v2: CONDITIONAL PASS (Telegram delivery server-ack confirmed; WeChat delivery `unverifiable` due to iLink Bot protocol limitation)
- 523 tests, 36 suites passing
- Protocol v0.4 — envelope format stable

#### Alpha caveats

This is an experiment, not a production service.

- Registry uses SQLite (WAL mode), single-instance alpha deployment. Data persists across server restarts.
- No identity guarantees. Bearer tokens are not authentication.
- Messages may be lost. Delivery is best-effort.
- Telegram delivery is server-ack confirmed (`message_id` from Bot API). WeChat delivery is `unverifiable` — the iLink Bot protocol does not provide a server-acknowledged message ID.
- No SLA. The hub may be offline at any time.
- Do not send sensitive content.

#### E2E content conversation

PASS on published package `0.8.0-alpha.1` — chorus-bridge and Telegram channel coexist in the same Gateway process. Full chain verified: inbound SSE delivery → agent content response → Telegram human-visible (`telegram_server_ack`, message_id=120) → outbound relay to sender. Evidence: `pipeline/bridge-v2-validation/evidence/P0-01-published-package-usability.md`.

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

## 2. Acceptance Boundary

**In scope for v0.8.0-alpha.1:**
- All fixes from 094c684..c0c7800 (verify exit code, credential path, runtime bundling)
- Cold-start PASS on machine without source repo
- Bridge v2 CONDITIONAL PASS (Telegram confirmed, WeChat unverifiable)
- 523 tests / 36 suites green

**Validated post-publish (2026-03-30):**
- E2E content conversation: PASS (P0-01 evidence — inbound SSE + Telegram delivery + outbound relay)

**Explicitly NOT in scope:**
- WeChat delivery confirmation (BLOCKED by iLink Bot protocol, external issue)
- Full multi-agent autonomous conversation validation

## 3. Overclaim Audit

| Phrase | Status | Safe alternative |
|--------|--------|-----------------|
| "已经支持完整 autonomous multi-turn" | ❌ Not yet | "Multi-turn autonomous conversation in final integration" |
| "OpenClaw 已正式稳定" | ❌ Not yet | "Invite-gated alpha" |
| "bridge 已全面闭环" | ❌ Not yet | "User-visible relay validated on one OpenClaw bridge path" |
| "confirmed delivery on all channels" | ❌ Never | "Telegram server-ack confirmed; WeChat unverifiable (protocol limitation)" |
| "Protocol v0.4 — stable" | ⚠️ Qualified | "Protocol v0.4 — envelope format stable" |

## 4. Future Publish Procedure (tag-then-publish)

For the next release, follow this sequence:

1. Bump version in `packages/chorus-skill/package.json`
2. Commit
3. `git tag v<version>` on that commit
4. `./bin/pre-publish-check.sh` — must PASS (clean tree + tests + tag==HEAD + tarball files + registry clean)
5. `cd packages/chorus-skill && npm publish --tag alpha`
6. `npm dist-tag add @chorus-protocol/skill@<version> latest`
7. `git push && git push --tags`
