# Handoff — 2026-04-03

## ⚡ 立即行动（第一步）

执行 IMPL-EXP03-04：修复 Telegram polling 断连。读 `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md`，改 `cli.mjs` 的 approve/complete 流程。

---

## 当前状态

- **项目**: Chorus Protocol — Bridge v2
- **Stage**: EXP-03 验证阶段
- **EXP-03 Run 2**: **PASS** — 6 分钟完成全链路（C-1 到 C-11 全部满足）
- **版本**: `@chorus-protocol/skill@0.8.0-alpha.9`（commit `bbf7f9c`，tag `v0.8.0-alpha.9`）
- **Conductor**: xiaox@chorus（xiaoyin API key 在清理 ~/.chorus/ 时丢失）

---

## 本会话完成事项

### 代码修复
- **IMPL-EXP03-03**: 去私有 Telegram 发送栈 — bridge 不再解析 botToken，改用 `accountId` 委托 OpenClaw channel helper
- **RESTART_CONSENT_HARD_GATE**: 新增 credentials-only 路径测试，验证 verify 不触发重启 gate
- commit `f222b70` + `bbf7f9c`，536 tests / 36 suites 全绿
- npm publish `0.8.0-alpha.9`

### 环境清理
- Mac mini + MacBook 全部 Chorus 痕迹清除（~/.chorus/, skills/chorus/, chorus-bridge/, credentials, openclaw.json 注册）
- MacBook SSH 配置修复（用户名 test2，ed25519 公钥添加）

### EXP-03 Run 2 执行
- Pre-flight 13.1-13.3 全部 PASS
- 受试者: 冷启动，MacBook (test2)
- 时间线: 18:40 开场 → 18:41 安装完成+请求重启 → 18:42 批准 → 18:46 Telegram 消息可见
- Agent ID: openclaw-test@agchorus
- Hub trace: `0c02a49a-4051-4391-8b22-ca27613f269d`，delivery_confirmed，telegram_server_ack ref=147
- 受试者口头确认收到消息

### 发现的缺陷
- **IMPL-EXP03-04**: Chorus 安装流程多次写入 openclaw.json → 触发 OpenClaw hot-reload 连锁重启 → Telegram polling 断连
  - 根因: `restart-consent approve` 写 openclaw.json 移除 deny，触发第二次自动重启
  - 影响: Chorus 消息投递后受试者的 Telegram bot 不再响应普通消息
  - 任务规格已写入: `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md`

---

## 待完成（按优先级）

1. [P0] **IMPL-EXP03-04**: approve 不写 openclaw.json，complete 合并清理
   - 改 `cli.mjs` approve/complete 逻辑
   - 更新测试
   - bump + publish

2. [P1] **EXP-03 正式结果报告**: 写 `docs/experiment-results/EXP-03-summary.md`
   - 含 Run 2 verdict (PASS) + 指标 + friction log + IMPL-EXP03-04 记录

3. [P2] **README 更新**: 将开场指令同步到 GitHub README（Commander 要求）

4. [P2] **xiaoyin@chorus API key 恢复**: 从 Fly.io 生产 DB 删除旧记录，重新注册获取新 key

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| Conductor 换为 xiaox@chorus | xiaoyin API key 在清理 ~/.chorus/ 时丢失 | 生产 Hub 无法本地删除已注册 agent |
| MacBook SSH 用户名 test2 | 非 owensun6 | MacBook 本机用户名不同 |
| EXP-03 PASS 不因 IMPL-EXP03-04 降级 | C-6 在 18:46 已满足 | Telegram 断连发生在 Chorus 消息投递之后 |

---

## 必读文件

1. `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` — 下一个修复任务
2. `packages/chorus-skill/cli.mjs` — approve (line ~713) 和 complete (line ~747) 的写入逻辑
3. `docs/experiments/EXP-03-human-developer-cold-start.md` — 已更新为 alpha.9 版本

---

## 风险与禁区

- **禁止**: 修改 EXP-03 判定结果（PASS 已由 Commander 确认）
- **注意**: approve 改为不写 openclaw.json 后，gateway tool 在 approve 到 complete 之间仍然被 deny — agent 必须在 approve 之后、gateway.restart 之前，由 OpenClaw 的 reload 自动重启（而非 agent 调用被 deny 的 gateway tool）。需要验证这个时序是否仍然可行。
- **注意**: MacBook 上 Chorus 安装痕迹已在 Run 2 中重新产生（init + credentials + bridge），如需再次清理需 SSH 到 test2@100.124.109.56

---

## 补充分析（2026-04-04，小v）

### 静态分析结论

这次 Telegram polling 断连问题，表面上看是 Chorus install / consent 流程的问题，实质上是：

> `restart-consent approve` 把“逻辑状态变化”实现成了对 `openclaw.json` 的再次写入，而 `openclaw.json` 又是 OpenClaw 的热配置文件，会触发 watcher reload，从而绕过 restart consent 原本想控制的重启时机。

换句话说，当前 bug 的根因不只是“多写一次配置”，而是：
- **gate 状态**（armed / awaiting_approval / approved / complete）
- **运行时副作用**（`tools.deny.gateway` 变化导致 OpenClaw reload）

这两层状态被耦合在了一起。

### 已确认的代码事实

1. `init --target openclaw` 的 `registerOpenClaw()` 会：
   - 注册 skill
   - 注册 bridge plugin
   - 调 `applyRestartGateBlock(config)`
   - `writeJSON(OPENCLAW_CONFIG_PATH, config)`

   这对应第一次 `openclaw.json` 写入。

2. `restart-consent approve` 当前实现会：
   - `readOpenClawConfig()`
   - `restoreRestartGateBlock(config, gate)`
   - `writeJSON(OPENCLAW_CONFIG_PATH, config)`
   - 然后 `writeRestartGate(...status:"approved")`

   这说明 approve 阶段确实会再次写 `openclaw.json`，与 task spec 描述一致。

3. `restart-consent complete` 当前主要负责：
   - 校验 post-restart proof
   - 写 completion proof
   - 删除 checkpoint
   - 删除 gate

   它目前**不是**承担 `openclaw.json` 清理的主位置。

### 我认同的修复方向

我认同 `TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` 的主方案：

- `approve` 只更新 `~/.chorus/restart-consent.json`
- `approve` 不写 `openclaw.json`
- `complete` 再统一执行：
  1. remove `gateway` from `tools.deny`
  2. 单次写回 `openclaw.json`
  3. 删除 gate / checkpoint

这能把总写次数压到：
- `init`: 1 次
- `complete`: 1 次
- `approve`: 0 次

并把“授权”和“副作用配置写入”重新解耦。

### 仍需验证的关键风险

真正需要下一位实现 agent 重点验证的，不是“能不能删掉 approve 里的写配置”，而是：

> **approve 不再写 openclaw.json 之后，approve → restart → complete 这条时序是否仍然闭环？**

尤其要查清楚：

1. 在 approve 之后、complete 之前，`tools.deny.gateway` 仍存在时：
   - agent 是否还能合法完成 restart 流程？
   - 这条链到底依赖显式 `gateway.restart`，还是依赖某次自动 reload？

2. 如果把 approve 的配置写入拿掉：
   - 是否会修掉 Telegram polling 断连
   - 但同时让 consent flow 卡在“已批准、却没有实际 restart 发生”的中间态

3. `tools.deny.gateway` 的约束边界要重新确认：
   - 它到底只限制 agent 调用 gateway tool
   - 还是也间接影响当前恢复路径中的某些自动步骤

### 建议后续修复 agent 先做的事（只读/验证优先）

1. 复盘 OpenClaw 对 `openclaw.json` 的 reload 语义
   - 是全量重启、局部 reload、还是 plugin reload
   - 为什么 Telegram polling 在第二次后丢失恢复能力

2. 画出 approve → restart → complete 的真实时序图
   - 当前成功路径究竟依赖哪次 reload / 哪个 restart

3. 明确 `gateway` deny 在整个 consent window 内的真实行为边界
   - 避免修掉 reload 问题后又引入“批准后无法完成重启”的新阻塞

### 一句话给下一位修复者

**这不是一个简单的“删掉一行 writeJSON”问题，而是一个“把逻辑状态与运行时副作用重新解耦”的问题。**
