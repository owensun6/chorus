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
