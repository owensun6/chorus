# Handoff — 2026-03-31 (alpha.7 发布 + EXP-03 重测 INCOMPLETE)

## ⚡ 立即行动（第一步）

排查 bridge → Telegram 投递失败根因。读 MacBook gateway 日志：`ssh test2@100.124.109.56 "cat ~/.openclaw/logs/gateway.log | grep -i chorus | tail -50"`。Hub 侧 `delivered_via=sse` 已确认消息到达 bridge，断点在 bridge 内部的 `deliverInbound` → Telegram 发送路径。

---

## 当前状态

- **版本**: `@chorus-protocol/skill@0.8.0-alpha.7` (tag `v0.8.0-alpha.7`, npm published)
- **CI**: 529/529 全绿 (commit `dd169c2`)
- **EXP-03 重测**: INCOMPLETE — 安装链路全自主完成，Chorus 消息未在 Telegram 可见
- **Hub**: `test2-macbook@agchorus` online, `xiaox@chorus` offline (缺 hub_url)

---

## 本会话完成事项

### 1. Restart consent checkpoint
- Task spec: `pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md` (commit `2375a14`)
- EN + zh-CN SKILL.md 模板实现: 各 +36 行 (commit `4e80a87`)
- **实验结果**: 两台机器的 agent 都忽略了 consent 规则，直接自行重启 gateway

### 2. Alpha.7 发布
- bump → tag `v0.8.0-alpha.7` → npm publish (commit `738b84f`)
- Registry 验证 PASS

### 3. Doc hardening (4 项整改)
- skill/ 同步 packages/ (5 文件): commit `69c5696`
- EXP-03 版本锁 alpha.7: commit `69c5696`
- CI stale version gate: commit `9f6953b`
- CI SSE test fix (4 轮迭代): commit `dd169c2`

### 4. EXP-03 重测
- 受试者: Commander 同事（首次接触 Chorus）
- 任务: "帮我装一下这个项目：https://github.com/owensun6/chorus，装完以后让它跑起来，我要在 Telegram 上看到消息"
- MacBook agent (Nano) 自主完成: npx init → 注册 `test2-macbook@agchorus` → gateway restart → bridge active
- Mac mini agent (小x) 自主完成: 注册 `xiaox@chorus` → gateway restart → bridge active
- 小x 发送 Chorus 消息给 test2-macbook → Hub `delivered_via=sse` → **Telegram 未收到**

---

## 待完成（按优先级）

1. [P0] **Bridge → Telegram 投递失败根因排查** — Hub 确认 SSE 到达，bridge 内部 deliverInbound 或 Telegram 发送失败。查 MacBook gateway 日志
2. [P0] **小x 凭证修复** — `xiaox@chorus` 缺 `hub_url`，bridge 无法连接 SSE。需要清除旧凭证让 agent 重新注册到 `@agchorus`
3. [P1] **Restart consent 机制重新设计** — SKILL.md 软约束无效，需要代码级门禁（CLI pre-restart hook 或 bridge 内部检查）
4. [P2] **EXP-03 再次重测** — 修复投递问题后用新受试者重跑

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| SKILL.md 软约束无效 | Agent 忽略 restart consent + checkpoint 规则 | LLM 将 SKILL.md 视为建议非命令；关键行为必须代码强制 |
| 环境清理需含 config | 删 bridge 文件不够，必须同时清 openclaw.json 引用 | 旧引用导致 config 递归栈溢出 |
| EXP-03 此轮 INCOMPLETE | 安装成功但消息不可见 | C-5 未满足（Telegram 可见），不是 FAIL（受试者未放弃，是 IMPL 问题） |

---

## 必读文件

1. `packages/chorus-skill/templates/bridge/runtime-v2.ts` — deliverInbound 方法，投递链断点所在
2. `tests/bridge/runtime-v2.test.ts` — 25 个测试含 default-only 和 fallback 覆盖
3. `docs/experiments/EXP-03-human-developer-cold-start.md` — 实验规格（已锁 alpha.7）
4. `pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md` — restart consent 规格

---

## 风险与禁区

- **禁止**: 在 EXP-03 运行中修代码或文档——先记录再修
- **注意**: MacBook 上 `~/.openclaw/workspace/.chorus-quarantine-exp03` 是隔离的旧 workspace，不要删
- **注意**: Mac mini 的 `xiaox@chorus` 凭证是旧格式（缺 hub_url），不要直接编辑——应该删除让 agent 重注册
- **注意**: `doNotFake` 方式修 fake timer 问题无效——只有移除 fake timers + 用真实 setTimeout 才行
