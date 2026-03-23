# Handoff — 2026-03-23（4号：Receive Chain Observability）

## ⚡ 立即行动（第一步）

重启 openclaw gateway，从 xiaox 发一条 chorus 消息到 xiaov，grep xiaov 日志中 `[sse-recv]` 和 `[process]`。根据输出判断断点位置。

---

## 当前状态

- **项目**: Chorus Protocol — Bridge 收件链路可靠性
- **Stage**: 非 Fusion-Core 流水线任务，属 bridge 运维加固
- **阻塞点**: xiaox→xiaov 反向链路 FAIL（Hub 返回 delivered_sse 但 bridge 无处理日志），断点需 live 日志定位

---

## 本会话完成事项

### 轮次 1 — Session Isolation（已完成，1号 live 验证 PASS）
- `resolve.ts` 新增 `deriveChorusSessionKey(agentName, senderId, conversationId?)` 纯函数
- `index.ts` 将 `SessionKey` 从 `route.sessionKey` 改为 `chorusSessionKey`
- `updateLastRoute` 改为指向 chorus session（不覆盖人类主会话）
- 13 tests in `session-isolation.test.ts`
- **1号已验证**: chorus session `chorus:xiaox:xiaov@openclaw` 与 human session `agent:xiaox:main` 隔离 PASS

### 轮次 2 — Self-Send Guard + Context Diagnostics（已完成，1号 live 验证 PASS）
- SSE + catch-up 两条入口加 `sender_id === agent_id` 过滤
- guard 后写 seen（防 catch-up 重入），不写 inbox，不进 processMessage
- `processMessage` 加 `[context]` 诊断日志（7 字段）
- 12 tests in `self-send-guard.test.ts`
- **1号已验证**: xiaov 不再处理自己发出的 chorus 消息 PASS；xiaox context 日志 culture=en lang=en PASS

### 轮次 3 — Receive Chain Trace Logs（本轮，待 live 验证）
- SSE 路径 6 个 trace 点 `[sse-recv]`
- catch-up 路径 6 个 trace 点 `[catch-up]`
- `validateSSEPayload` 每个失败分支加 `[validate]` 日志
- `processMessage` 统一 `[process] START` / `FAIL reason=X` / `SUCCESS`
- SSE 建连增加 `agent_id`
- 全部文件已 sync 到 package template

---

## 待完成（按优先级）

1. [P0] **Live 验证反向链路** — 重启 gateway，xiaox→xiaov 发 chorus 消息，grep trace 日志定位断点
   - 如果没有 `[sse-recv] event received` → SSE 连接问题（token/Hub 推送目标错误/jiti 缓存）
   - 如果有 recv 但没有 `[process] START` → 被 validation/seen/self-send 拦截（日志会写明原因）
   - 如果有 START 但有 FAIL → reason 字段直接告诉哪个 pre-check 挂了
2. [P1] **jiti 缓存问题** — 1号上次发现 gateway 未加载最新代码（零条 `[sse-recv]` 日志），可能需要完全重启 openclaw 进程
3. [P2] **Hub SSE push 可靠性** — delivered_sse 但 client 未消费的情况已出现 2 次（trace_id: e89196f2, de3a2828）

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| Session key 格式 | `chorus:{agent}:{sender}` 或 `chorus:{agent}:{sender}:{conv}` | 隔离 chorus reply_format 不污染人类主会话 |
| Self-send guard 写 seen | guard 后立即 `ctx.seen.add()` + `saveSeen()` | 防止 catch-up 路径重复处理同一 trace_id |
| updateLastRoute 指向 chorus session | 不用 `route.mainSessionKey` | 防止 chorus 流量覆盖人类的"最后活跃渠道" |
| Trace 日志不猜断点 | 只加探针，不在没有证据时修 bug | 已确认无法离线定位，必须靠 live 日志 |

---

## 必读文件

1. `~/.openclaw/extensions/chorus-bridge/index.ts` — bridge 主文件，所有修改都在这里
2. `~/.openclaw/extensions/chorus-bridge/resolve.ts` — 纯函数：session key 派生、reply split、envelope 构建
3. `memory-bank/progress.md` 最后 40 行 — 1号的 live 验证结果和本轮记录

---

## 风险与禁区

- **禁止**: 在没有 live 日志证据的情况下猜测断点并修改代码 — 原因：已多次证明猜测不可靠
- **注意**: jiti 缓存可能导致 gateway 运行旧代码 — 正确做法：完全停止 openclaw 进程后重启，不是热重载
- **注意**: Hub `delivered_sse` 不等于 bridge 已消费 — 只表示 Hub 将数据推入了 SSE stream，bridge 可能未连接或未读取
