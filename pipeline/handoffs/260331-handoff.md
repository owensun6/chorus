# Handoff — 2026-03-31

## ⚡ 立即行动（第一步）

执行 IMPL-EXP03-03：去掉 bridge 私有 Telegram 发送栈。读 Commander 的任务规格（本文件"待完成"section），然后读 `packages/chorus-skill/templates/bridge/runtime-v2.ts:530-534`（`resolveTelegramBotToken`）和 `runtime-v2.ts:1152-1170`（直接调 Telegram Bot API），这两段是要删除的目标。

---

## 当前状态

- **项目**: Chorus Protocol — Bridge v2
- **Stage**: 验证阶段（P0-01 PASS，EXP-03 进行中）
- **Gate 状态**: P0-01 CLOSED (bidirectional PASS)；EXP-03 BLOCKED by IMPL-EXP03-03
- **阻塞点**: bridge 自带私有 Telegram Bot API 发送栈，单 agent 扁平配置不兼容

---

## 本会话完成事项

- P0-01 bidirectional PASS 入库 → commit `2b33d4b`
- EXP-03 规格更新为当前架构 → `docs/experiments/EXP-03-human-developer-cold-start.md` (commit `af5288d`)
- MacBook 预飞检查 PASS → 环境干净，Hub 健康，npm 可达
- EXP-03 第一轮执行 → 3 个 IMPL 缺陷逐层暴露：
  1. `no_delivery_target` (agent name mismatch) → 修复 + publish alpha.2 (commit `af5288d`)
  2. `no_culture_config` (credential file 缺 culture) → 修复 + publish alpha.3 (commit `5c8042a`)
  3. `no_tg_bot_token` (bridge 私有 Telegram 发送栈) → Commander 判定为架构级问题，不做 config fallback
- MacBook 已清理干净（uninstall + rm ~/.chorus/ + rm credentials）

---

## 待完成（按优先级）

1. [P0] **IMPL-EXP03-03: Host delivery adapter 去私有发送栈** — 依赖：无代码依赖，Commander 已签发任务规格
   - Owner: be-ai-integrator
   - 删除 `resolveTelegramBotToken()` 和 `sendTelegramMessage()`
   - Telegram 投递改用 OpenClaw 官方 channel helper
   - 测试：单 bot 扁平 / 多账号 / 多账号无匹配 / 回归
   - 完成后 bump + publish + 换新受试者重跑 EXP-03
   - 允许改的文件：`runtime-v2.ts`, `tests/bridge/runtime-v2.test.ts`, 可新增 bridge 内部 adapter
   - 禁止改：EXP-03 规格、受试者环境配置、新增 channel/account 绕过

2. [P1] **EXP-03 重测** — 依赖：IMPL-EXP03-03 完成 + npm publish
   - 必须换新受试者（MacBook test2 已被 3 次安装污染）
   - 用最新 npm 版本（不是 alpha.3，alpha.3 仍有私有发送栈）
   - 冻结文档运行，不预修已知摩擦点

3. [P2] **release-package.md 更新** — 依赖：EXP-03 PASS
   - 记录新版本发布记录（alpha.2, alpha.3, alpha.4+）
   - 更新 rectification history

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| Bridge 不耦合 Telegram | bridge 不应自带 Telegram Bot API 调用或配置解析 | 架构原则：protocol bridge ≠ channel delivery |
| EXP-03 冻结版本运行 | 不预修已知摩擦点，让实验暴露盲点 | 实验目的是测已发布包的真实可发现性 |
| 换新受试者 | 每轮 EXP-03 必须用未被污染的受试者 | EXP-03 规格 Section 14 明确禁止复用 |
| 实际用户旅程 | 真实人类只会给 OpenClaw 一个 GitHub URL，不会自己跑 npx | Commander 纠正了原始 EXP-03 假设 |

---

## 必读文件

1. `packages/chorus-skill/templates/bridge/runtime-v2.ts` — 修改主目标，特别是 `resolveTelegramBotToken`(530行) 和 `deliverInbound`(906-1200行)
2. `packages/chorus-skill/templates/bridge/resolve.ts` — 纯函数层，已在本会话修改（添加 `collectTelegramTargetsFromAgentDirs`）
3. `docs/experiments/EXP-03-human-developer-cold-start.md` — 已更新的实验规格（不要再改）
4. `pipeline/bridge-v2-validation/monitor.md` — 验证看板当前状态

---

## 风险与禁区

- **禁止**: 用配置 [goooo] channel 或 accounts.default.botToken 补丁绕过 — Commander 明确拒绝
- **禁止**: 修改 EXP-03 规格或 SKILL.md 内容 — 冻结状态
- **注意**: OpenClaw Gateway 的 channel helper API 表面尚未探索 — 需要查看 `this.api.runtime.channel` 提供了哪些官方发送方法
- **注意**: MacBook plist 中暴露了 API keys — 不要在日志或文档中复制
- **注意**: `runtime-v2.ts` 有 1400+ 行 — 只改发送路径，不改 session 注入、replay、recovery 等逻辑
