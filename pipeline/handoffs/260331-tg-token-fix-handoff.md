# Handoff — 2026-03-31 (Bridge TG Token Fallback Fix)

## ⚡ 立即行动（第一步）

读取 `pipeline/monitor.md`。P0 投递阻塞已修复（`bd8e7bd`）。下一步：清理 EXP-03 规格 + 准备 Run 2。先读 `docs/experiment-results/EXP-03-summary.md` 了解 Run 1 结论。

---

## 当前状态

- **版本**: `@chorus-protocol/skill@0.8.0-alpha.7` (npm published)
- **HEAD**: `bd8e7bd` fix(bridge): fallback to global openclaw.json for Telegram bot token
- **CI**: 531/531 tests green
- **EXP-03 Run 1**: VOID（审计缺失 + E-4 违反），IMPL 阻塞已解除
- **MacBook 部署**: 修复已 scp 到 test2，3/3 消息投递成功（Telegram 截图已确认）

---

## 本会话完成事项

- **根因定位**: `deliverInbound` 从 `api.config`（plugin-scoped）读 botToken，部分 OpenClaw 运行时 plugin config 不含 channel credentials。Token 仅在全局 `~/.openclaw/openclaw.json`
- **代码修复**: `runtime-v2.ts:902-913` — plugin config 无 token 时 fallback 读全局 openclaw.json
- **测试整改**（2 轮 Commander review）:
  - harness 去掉默认 botToken，default-only/fallback 断言 `flat-bot-token`
  - recovery 回归走真 `RecoveryEngine.recover()` 路径（`recovery.test.ts`）
  - token fallback 测试（无 config → throw → write config → succeed，`runtime-v2.test.ts`）
- **Live 验证**: MacBook `test2-macbook@agchorus` 3/3 delivery_confirmed（ref 141/142/143），Telegram 截图确认
- **Commit**: `bd8e7bd` — 3 files, +146/-8, 531/531 green

---

## 待完成（按优先级）

1. [P0] **小x 凭证修复** — `~/.openclaw/workspace/chorus-credentials.json` 旧格式（缺 `hub_url`），需删除让 agent 重新注册
2. [P1] **Restart consent 代码级门禁** — SKILL.md 软约束无效（Gene `gene-20260331-soft-constraint-ineffective`），需代码强制
3. [P1] **EXP-03 规格修订** — 当前规格假设受试者手动 npx，实际用户旅程是"告诉 agent 一句话"。调整 task prompt、debrief 问题、成功标准
4. [P1] **alpha.8 bump + publish** — 包含 token fallback fix，需 tag-then-publish 序列
5. [P2] **EXP-03 Run 2** — 用新受试者（非同组织），提前设置录屏+history 采集
6. [P2] **docs/evidence/ 整理入仓** — 截图和证据文档待 Commander 审批后提交

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| Fallback 读全局 config | plugin config 无 token → 读 `~/.openclaw/openclaw.json` | plugin API 不保证携带 channel credentials |
| 证据不入提交 | docs/evidence/ 排除在 commit 外 | Commander 指示：先补真 recovery 测试再谈证据 |
| 读对日志文件 | runtime log 在 `/tmp/openclaw/` 不在 `~/.openclaw/logs/` | 上一个 handoff 指向了错误路径，浪费排查时间 |

---

## 必读文件

1. `packages/chorus-skill/templates/bridge/runtime-v2.ts:902-913` — token fallback 修复代码
2. `tests/bridge/recovery.test.ts` — recovery 回归测试（最后一个 `it` block）
3. `docs/experiment-results/EXP-03-summary.md` — Run 1 结论，指导 Run 2 规划
4. `docs/evidence/IMPL-bridge-tg-token-fallback.md` — live 证据（未入仓）

---

## 风险与禁区

- **禁止**: 修改 EXP-03 规格文档来"适配"当前结果——先修 IMPL 问题再考虑规格调整
- **注意**: MacBook runtime-v2.ts 是 scp 手动部署的，不是通过 npm publish。alpha.8 发布后需重新 npx 安装
- **注意**: `diag-probe-1774960590@agchorus` 是本次排查注册的探针 agent，可清理
- **注意**: 5 条 Gene 达毕业条件（confidence ≥ 0.8），考虑运行 /fusion-graduate
