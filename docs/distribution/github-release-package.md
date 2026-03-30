# GitHub Release Materials Package

> Updated: 2026-03-30
> Status: Rectified — v0.8.0-alpha published from wrong baseline, correcting with v0.8.0-alpha.1
> Previous npm publish: `@chorus-protocol/skill@0.8.0-alpha` from `6b0a2b2` (missing 10 commits of critical fixes)
> Current tag: `v0.8.0-alpha` → `6b0a2b2` (retroactive traceability only)
> Next tag: `v0.8.0-alpha.1` → current HEAD after rectification complete

---

## 0. Baseline Rectification Record

### What happened

On 2026-03-29, `@chorus-protocol/skill@0.8.0-alpha` was published to npm from commit `6b0a2b2`. After publish, 10 additional commits landed on main (094c684..70102e3) containing 3 critical product fixes:

| Commit | Fix |
|--------|-----|
| `094c684` | verify 假阳性 — standby 报 exit 0，用户误以为安装完成即可用 |
| `c2217fc` + `67b8c28` | 凭证双轨不通 — workspace 路径优先 + 5s 轮询热激活 |
| `0b9aad5` + `8ae072c` | 源码路径硬依赖 — 9 个运行时模块打包 + jiti zod alias |

### Rectification path (tag-then-publish)

1. `v0.8.0-alpha` tag → `6b0a2b2`（追溯标记，不重新发布）
2. bump `package.json` → `0.8.0-alpha.1`
3. commit all rectification changes
4. git tag `v0.8.0-alpha.1` on that commit
5. `./bin/pre-publish-check.sh` — 校验 clean tree + tests + tag==HEAD + tarball 文件集 + registry 无冲突
6. `cd packages/chorus-skill && npm publish`
7. `git push && git push --tags`

> **时序铁律**: 先 tag 再 publish。`pre-publish-check.sh` 强制要求 tag 已存在且指向 HEAD，否则阻断。

---

## 1. Release Notes Draft

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

BLOCKED — OpenClaw Gateway plugin-channel mutual exclusion prevents chorus-bridge and Telegram channel from coexisting. This is an external platform issue, not a Chorus defect. Not gating this release.

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

## 2. Pre-publish Checklist (tag-then-publish)

Sequence: commit → tag → pre-publish-check → npm publish → push

- [x] Retroactive tag `v0.8.0-alpha` on `6b0a2b2`
- [x] Version bumped to `0.8.0-alpha.1` in `packages/chorus-skill/package.json`
- [x] Test count verified: 523 tests, 36 suites (2026-03-30)
- [x] `bin/pre-publish-check.sh` created (validates tarball against BRIDGE_REQUIRED_FILES)
- [ ] `agchorus.com/health` is green
- [ ] Commander reviews release notes
- [ ] Commit rectification changes
- [ ] Git tag `v0.8.0-alpha.1` on commit
- [ ] `./bin/pre-publish-check.sh` passes
- [ ] `cd packages/chorus-skill && npm publish`
- [ ] `git push && git push --tags`

## 3. Acceptance Boundary

**In scope for v0.8.0-alpha.1:**
- All fixes from 094c684..HEAD (verify exit code, credential path, runtime bundling)
- Cold-start PASS on machine without source repo
- Bridge v2 CONDITIONAL PASS (Telegram confirmed, WeChat unverifiable)
- 523 tests / 36 suites green

**Explicitly NOT in scope:**
- E2E content conversation (BLOCKED by OpenClaw Gateway, external issue)
- WeChat delivery confirmation (BLOCKED by iLink Bot protocol, external issue)
- Full multi-agent autonomous conversation validation

## 4. Stale Domain / Claim Inventory

Carried forward from previous version — all `chorus-alpha.fly.dev` → `agchorus.com` updates completed. See git history for details.

### Overclaim audit (things we must NOT say)

| Phrase | Status | Safe alternative |
|--------|--------|-----------------|
| "已经支持完整 autonomous multi-turn" | ❌ Not yet | "Multi-turn autonomous conversation in final integration" |
| "OpenClaw 已正式稳定" | ❌ Not yet | "Invite-gated alpha" |
| "bridge 已全面闭环" | ❌ Not yet | "User-visible relay validated on one OpenClaw bridge path" |
| "confirmed delivery on all channels" | ❌ Never | "Telegram server-ack confirmed; WeChat unverifiable (protocol limitation)" |
| "Protocol v0.4 — stable" | ⚠️ Qualified | "Protocol v0.4 — envelope format stable" |
