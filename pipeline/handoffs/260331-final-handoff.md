# Handoff — 2026-03-31 (Final — EXP-03 Run 1 VOID + IMPL blocker)

## ⚡ 立即行动（第一步）

排查 bridge → Telegram 投递失败。运行 `ssh test2@100.124.109.56 "cat ~/.openclaw/logs/gateway.log" | grep -i "deliver\|inbound\|error\|fail" | tail -50` 查看 MacBook 上 bridge 收到 SSE 消息后的处理日志。断点在 `runtime-v2.ts:deliverInbound` 方法。

---

## 当前状态

- **版本**: `@chorus-protocol/skill@0.8.0-alpha.7` (npm published, CI green)
- **HEAD**: `c04d134` = origin/main, CI PASS (529/529)
- **EXP-03 Run 1**: VOID — 审计材料缺失 + E-4 违反。实质 IMPL 阻塞（bridge→TG 投递失败）
- **阻塞点**: bridge 收到 Chorus 消息（Hub `delivered_via=sse`）但未转发到 Telegram

---

## 本会话完成事项

### 代码 + 发布
- Restart consent checkpoint spec + 实现: `2375a14`, `4e80a87`
- Alpha.7 bump + publish: `738b84f`, tag `v0.8.0-alpha.7`
- Doc sync (skill/ ← packages/): `69c5696`
- CI stale version gate: `9f6953b`
- SSE fake timer fix (4 轮迭代): `dd169c2`

### EXP-03 Run 1
- 环境清理: MacBook + Mac mini 全清（含 openclaw.json 修复）
- 受试者执行: Commander 同事，单指令 "帮我装一下这个项目"
- 结果: 安装+注册+bridge 激活全自主完成，Chorus 消息未在 Telegram 可见
- 产物冻结: 10 个文件 at `docs/experiment-results/`（summary, friction-log, transcript, hub-activity, gateway-log, question-log, debrief, contamination-check, screening, screenshots）

### Gene 萃取
- gene-20260331-soft-constraint-ineffective (0.7) — SKILL.md 软约束对 agent 行为无效
- gene-20260331-clean-env-includes-config (0.9) — 清理环境必须含 openclaw.json 引用
- gene-20260331-fake-timers-setimmediate (0.9) — Jest fake timers 与 ReadableStream 不兼容

---

## 待完成（按优先级）

1. [P0] **Bridge→TG 投递失败根因** — Hub 确认 SSE 到达，bridge `deliverInbound` 未将内容发到 Telegram。查 MacBook gateway 日志（已部分捕获在 `EXP-03-run1/macbook-gateway.log`，但缺投递相关行）
2. [P0] **小x 凭证修复** — `~/.openclaw/workspace/chorus-credentials.json` 包含旧格式 `xiaox@chorus`（缺 `hub_url`），bridge 无法连接 SSE。需删除让 agent 重新注册
3. [P1] **Restart consent 重新设计** — SKILL.md 软约束无效（Gene 记录），需要代码级门禁
4. [P1] **EXP-03 规格修订** — 当前规格假设受试者手动 npx，实际用户旅程是"告诉 agent 一句话"。需要调整 task prompt、debrief 问题、成功标准
5. [P2] **EXP-03 Run 2** — 修复投递问题后，用新受试者（非同组织）重跑，必须提前设置录屏+history 采集

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| VOID 不是 FAIL | Run 1 因审计缺失标 VOID，实质发现是 IMPL 问题 | 审计完整性是独立于技术结果的程序要求 |
| E-4 违反 | 受试者与 Commander 同组织 | 协议 Section 2 排除标准 |
| 不现场救火 | 发现投递失败后冻结 run，不在实验中调试 | 实验纪律 |
| SKILL.md 约束无效 | 两台 agent 都忽略 restart consent 规则 | Gene 记录，需代码级强制 |

---

## 必读文件

1. `docs/experiment-results/EXP-03-summary.md` — Run 1 完整结论
2. `docs/experiment-results/EXP-03-friction-log.md` — 时间线 + 分类
3. `packages/chorus-skill/templates/bridge/runtime-v2.ts` — deliverInbound 方法（投递断点）
4. `docs/experiment-results/EXP-03-run1/macbook-gateway.log` — bridge 激活日志（缺投递行）
5. `pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md` — 已实现但未生效的 spec

---

## 风险与禁区

- **禁止**: 修改 EXP-03 规格文档来"适配"当前结果——先修 IMPL 问题再考虑规格调整
- **注意**: MacBook `~/.openclaw/workspace/.chorus-quarantine-exp03` 是隔离的旧 workspace，实验后可恢复或删除
- **注意**: `doNotFake` 方式修 Jest fake timer 问题无效——4 轮迭代证明只有移除 fake timers + 真实 setTimeout 才行
- **注意**: npx cache 必须清除（`rm -rf ~/.npm/_npx/`）否则会安装旧版本
