# Handoff — 2026-03-30

## ⚡ 立即行动（第一步）

无紧急待办。P0-01 已关闭，项目处于稳定状态。若有新任务，读取 `pipeline/bridge-v2-validation/monitor.md` 和 `docs/distribution/github-release-package.md` 了解当前发布状态。

---

## 当前状态

- **项目**: Chorus Protocol — Agent 间跨平台通信协议
- **发布版本**: `@chorus-protocol/skill@0.8.0-alpha.1` (npm live)
- **Hub**: agchorus.com v0.7.0-alpha (46 agents, 2575 messages delivered)
- **Bridge v2 验证**: CONDITIONAL → P0-01 PASS（E2E 内容对话已验证）
- **阻塞点**: 无 P0 阻塞。WeChat delivery 仍为 `unverifiable`（iLink Bot 协议限制，外部问题）。

---

## 本会话完成事项

1. **npm 发布整改（3 轮 rectification list）**
   - v0.8.0-alpha baseline 错误修复 → retroactive tag + bump to 0.8.0-alpha.1
   - `bin/pre-publish-check.sh` 创建 → 验证 17 bridge files + 4 skill templates + tag==HEAD
   - 发布真相源 `docs/distribution/github-release-package.md` 最终定稿为 PUBLISHED 状态
   - Commits: `c0c7800`, `6cd6586`

2. **P0-01 已发布包可用性闸门 — PASS**
   - 从 npm 干净重装 → verify PASS → Gateway 启动 → bridge + Telegram 共存
   - 互斥根因确认：旧安装从源码路径加载 runtime（heavy jiti），npm 包 bundled runtime 不阻塞
   - 完整 E2E 链路验证：`delivered_sse` → `telegram_server_ack` (msg_id=120) → outbound relay
   - 证据入库 + monitor 更新 + 远端同步
   - Commits: `3dfda8a`, `d70f9d5`

3. **Commander 签字**: P0-01 CLOSED (PASS), 不需要 alpha.2, 不标 OpenClaw 为产品阻断

---

## 待完成（按优先级）

1. [P1] GitHub Release 创建 — release notes 在 `docs/distribution/github-release-package.md` §1 已就绪，需 `gh release create v0.8.0-alpha.1`
2. [P1] 9 个 Gene 达毕业条件（confidence ≥ 0.8）— 运行 `/fusion-graduate` 写入兵种 SKILL.md
3. [P2] awesome-list PR 提交 — 历史版本 doc 中有草稿，已被重写删除，在 git history 中可恢复
4. [P2] OpenClaw Gateway 更新 — 当前 v2026.3.12，可选更新到 v2026.3.28

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 不发 alpha.2 | 0.8.0-alpha.1 已包含所有修复，E2E 验证通过 | Commander 2026-03-30 签字 |
| 互斥归因 Chorus | 源码路径 runtime 加载是 Chorus 侧问题，非 OpenClaw 缺陷 | P0-01 证据：npm 包 bundled runtime 共存成功 |
| tag-then-publish | 铁律：commit → tag → pre-publish-check → publish → push | 防止 baseline 错误重演 |
| envelope schema strict | v0.4 schema 使用 `.strict()`，不接受额外字段 | P0-01 测试中首次发现，设计如此 |

---

## 必读文件

1. `docs/distribution/github-release-package.md` — 发布记录和未来发布流程
2. `pipeline/bridge-v2-validation/monitor.md` — Bridge v2 验证状态（含 P0-01 关闭记录）
3. `pipeline/bridge-v2-validation/evidence/P0-01-published-package-usability.md` — E2E 验证证据
4. `bin/pre-publish-check.sh` — 下次发布必须运行的验证脚本

---

## 风险与禁区

- **禁止**: 在有源码仓库的机器上直接从 `~/.openclaw/extensions/chorus-bridge/` 手动复制文件测试 — 必须通过 `chorus-skill init --target openclaw` 从 npm 包安装，否则 runtime 路径不对
- **注意**: Gateway 启动后首次 SSE `fetch` 可能 TypeError: fetch failed（瞬态） — 自动重试后成功，非 bug
- **注意**: Hub `/agent/session` 返回 404（session token 未实现）— bridge 会自动 fallback 到 Bearer auth
