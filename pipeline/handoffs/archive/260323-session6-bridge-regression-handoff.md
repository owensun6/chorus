# Handoff — 2026-03-23 Session 6: Bridge Regression Testing

## ⚡ 立即行动（第一步）

清除 jiti 缓存后重启 gateway，重发 xiaox→xiaov 测试消息，确认 `[sse-recv]` 日志出现且 processMessage 执行。
```bash
rm -rf ~/.openclaw/.jiti-cache 2>/dev/null; pkill -9 -f openclaw-gateway; sleep 3; nohup openclaw gateway >/dev/null 2>&1 &
```

---

## 当前状态

- **项目**: Chorus Protocol — Bridge 运行验证
- **Stage**: 非 Fusion-Core 流水线任务，独立验证工单
- **阻塞点**: 反向链路 xiaox→xiaov 的 bridge SSE 消费问题

---

## 本会话完成事项

1. **Hub store-and-forward** — offline receiver → 202 queued → poll retrieval
   - 文件: `src/server/routes.ts` (queued 路径), `src/server/db.ts` (v3 migration), `src/server/registry.ts` (recordQueued), `src/server/message-store.ts` (delivered_via union), `src/server/activity.ts` (message_queued event)
   - 测试: 268→273 tests, 80.7% coverage
   - console-html: message_queued 事件 ⏳ 黄色图标

2. **xiaox 英文化** — 全套 persona 文件转英文
   - 文件: `~/.openclaw/workspace-xiaoxia/` — SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, USER.md, HEARTBEAT.md, MEMORY.md
   - 中文记忆/日记转移到 `~/.openclaw/workspace-xiaoxia/_zh-archive/`

3. **Session isolation 验证** (4号实现, 1号验证)
   - `[session] chorus="chorus:xiaox:xiaov@openclaw" human="agent:xiaox:main" (isolated)` — PASS
   - User session clean after chorus (Owen "hi" → 纯英文, 无 [chorus_reply]) — PASS
   - Self-send filter (xiaov 不处理自己发出的消息) — PASS
   - Agent context matches config (xiaox culture=en lang=en mustAdapt=true) — PASS

4. **反向链路 xiaox→xiaov** — FAIL
   - trace de3a2828: Hub delivered_sse, bridge inbox 有文件 (06:05:05), 但零条 bridge 处理日志
   - 根因: gateway jiti 缓存未加载 05:57 版代码 (零条 `[sse-recv]` 日志)

---

## 待完成（按优先级）

1. [P0] 反向链路 xiaox→xiaov 修复验证 — 依赖: jiti 缓存清除 + gateway 重启
   - 清除 jiti 缓存: `rm -rf ~/.openclaw/.jiti-cache`
   - 重启 gateway
   - 发 xiaox→xiaov 消息
   - 确认 `[sse-recv]` + `[context]` + `[session]` + `[wx-deliver]` 日志全部出现
   - 确认 WeChat 端 Owen 收到 xiaov 的中文回复

2. [P0] Hub SSE push 可靠性排查 — 依赖: Hub 代码审查
   - Hub 标记 delivered_sse 但 bridge SSE client 未消费的场景已出现 2 次 (e89196f2, de3a2828)
   - 可能原因: SSE stream chunk 缓冲、processMessage 阻塞事件循环、或 fetch ReadableStream 消费不完整

3. [P1] Session boundary 二次验证 — 依赖: P0 完成
   - 完整闭环: chorus 入站 → agent 回复含 [chorus_reply] → split → human 侧 PASS + relay 侧 PASS → Owen 后续消息无污染
   - 双向: xiaov→xiaox (Telegram) + xiaox→xiaov (WeChat)

4. [P2] `~/.chorus/config.json` 单文件 → per-agent 路径设计 — Commander 说等 2号/3号

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| Session isolation | chorus 入站用 `chorus:{agent}:{peer}` session key, 不与 `agent:{name}:main` 共享 | reply_format 指令持续污染后续 human turn |
| Self-send guard | SSE listener 在 processMessage 前检查 sender_id === agent_id | Hub SSE 回显 sender 的消息, 不过滤会导致 agent 处理自己的 outbound |
| OriginatingChannel | 设为 "chorus-bridge" 而非真实 channel | 防止 OpenClaw 内置 channel handler 接管, 迫使走 custom deliver callback |
| 截图解读 | Telegram 中文消息 ≠ xiaov 原文泄漏 | 一条是 chorus 入站回复, 一条是 xiaov→user 的正常微信内容 |
| xiaox 模型限制 | glm-5 中文原生模型 + 中文记忆 → 默认中文输出 | 已清理中文记忆, 但 model 本身倾向中文 |

---

## 必读文件

1. `~/.openclaw/extensions/chorus-bridge/index.ts` — Bridge 核心代码, 所有修改集中在此
2. `~/.chorus/agents/xiaov.json` + `xiaox.json` — Per-agent config (agent_id, api_key, culture, preferred_language)
3. `~/.openclaw/workspace-xiaoxia/` — xiaox persona 文件 (已转英文)
4. `/Volumes/XDISK/chorus/src/server/routes.ts` — Hub 路由, 含 store-and-forward 逻辑
5. `/Volumes/XDISK/chorus/docs/verification-report-2026-03-23.md` — 前几轮验证报告

---

## 风险与禁区

- **禁止**: 不检查 `ps aux | grep openclaw-gateway` 就启动新 gateway — 会产生双进程冲突, 导致日志交错和端口占用
- **禁止**: 假设 gateway 重启后自动加载最新 bridge 代码 — jiti 可能缓存旧版本, 需要 `rm -rf ~/.openclaw/.jiti-cache`
- **注意**: Hub `delivered_via: "sse"` 不等于 bridge client 已消费 — Hub 的 `inbox.deliver()` 写入 ReadableStream controller 后即返回 true, 但 client 端的 fetch 可能尚未读取该 chunk
- **注意**: gateway 初始化需要 ~20-30 秒, 其中 Telegram provider 启动最慢 — 不要在 SSE handshake OK 之前发测试消息
- **注意**: xiaox 的 contextToken (WeChat session token) 是内存态, gateway 重启后丢失 — 需要 Owen 在微信上给 xiaov 发一条消息才能刷新
