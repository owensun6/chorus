# Chorus Bridge 验收方案与回归清单

> 配合 spec v8 使用。1号交付后立即执行。

---

## 1. 运行手册

### 1.1 前提确认

```bash
# 插件目录存在
ls ~/.openclaw/extensions/chorus-bridge/index.ts
# → 存在 = 继续; 不存在 = 1号未交付

# config.json 存在（Chorus 注册凭证）
cat ~/.chorus/config.json
# → 应含 agent_id, api_key, hub_url

# weixin 插件存在
ls ~/.openclaw/extensions/openclaw-weixin/src/messaging/inbound.ts
# → 存在 = 继续
```

### 1.2 启动 OpenClaw

```bash
# 正常启动 OpenClaw（bridge 随其他插件一起加载）
openclaw
```

### 1.3 观察 probe 结果

在 OpenClaw 启动日志中寻找：

```
# PASS — 关键特征（不要精确匹配字符串，看含义）:
[chorus-bridge] probe OK          ← 含 "probe" + "OK" 即可，ext 值可能是 .js/.ts/空
[chorus-bridge] SSE connected     ← 含 "SSE" + "connect" 关键词

# FAIL 场景 A — no config — 关键特征:
[chorus-bridge] ... not found, bridge disabled    ← 含 config 路径 + "disabled"

# FAIL 场景 B — no weixin — 关键特征:
[chorus-bridge] ... weixin ... not found, bridge disabled

# FAIL 场景 C — probe failed — 关键特征:
[chorus-bridge] probe failed ... bridge disabled
```

### 1.4 确认 SSE 已连接

```bash
# 方式 1: Hub 健康检查
curl -s https://agchorus.com/health | jq '.data.inbox_connections'
# → 应 >= 1（小V 的 bridge 在线）

# 方式 2: Hub discover 看 online 状态
curl -s https://agchorus.com/discover | jq '.data[] | select(.agent_id | contains("xiaov"))'
# → "online": true

# 方式 3: OpenClaw 日志
# 应看到 "[chorus-bridge] SSE connected" 和周期性的 ":ping" 无报错
```

### 1.5 检查持久化文件

```bash
# cursor（catch-up 游标）
cat ~/.chorus/cursor.json
# → { "last_seen_id": N }（N 为最近处理的消息 ID）

# seen（幂等集合）
cat ~/.chorus/seen.json
# → ["trace-uuid-1", "trace-uuid-2", ...]

# inbox（待处理队列 — 正常应为空）
ls ~/.chorus/inbox/
# → 空 = 所有消息已处理; 有文件 = 有积压

# history（已投递记录）
ls ~/.chorus/history/
# → 有 .jsonl 文件 = 有历史
cat ~/.chorus/history/*.jsonl | tail -3
```

### 1.6 人工触发一条端到端消息

```bash
# 用小X（或任意已注册 agent）向小V 发消息
# 先拿小X 的 api_key
XIAOX_KEY="ca_..."  # 从小X的 config.json 读取

curl -X POST https://agchorus.com/messages \
  -H "Authorization: Bearer $XIAOX_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "xiaov@agchorus",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "xiaox@agchorus",
      "original_text": "Bridge acceptance test — can you hear me?",
      "sender_culture": "en",
      "cultural_context": "This is a technical test message from the QA process."
    }
  }'

# 预期结果:
# 1. Hub 返回 { "delivery": "delivered_sse", "trace_id": "..." }
# 2. 小V 的人类在微信收到翻译后的中文消息
# 3. ~/.chorus/history/ 下出现新记录
# 4. ~/.chorus/inbox/ 保持为空
# 5. ~/.chorus/seen.json 包含该 trace_id
```

---

## 2. 验收清单

按 spec v8 第 511-521 行验收标准逐项展开。

| # | 检查项 | 操作 | 预期结果 | PASS 条件 |
|---|--------|------|---------|-----------|
| P1 | probe 通过 | 启动 OpenClaw，读日志 | probe 成功日志出现 | 日志含 `probe` + `OK`（不绑定具体 ext 值） |
| P2 | gateway_start 正常 | 启动 OpenClaw，读日志 → 然后 `curl -s https://agchorus.com/discover \| jq` 确认 online | SSE 握手完成 | Hub 侧 `online: true` **且** 日志无 `reconnecting` |
| P3 | SSE 长连接存活 | `curl agchorus.com/health` | `inbox_connections >= 1` | online = true 且 30s 内无断连日志 |
| P4 | catch-up 能跑 | 先断 SSE（kill OpenClaw）→ 用 curl 发一条消息 → 重启 OpenClaw | 重启后补到消息 | `cursor.json` 更新 + history 新增 + 微信收到 |
| P5 | inbox 落盘 | 在步骤 ③ 处加断点（或观察高延迟消息） | `~/.chorus/inbox/{trace_id}.json` 存在 | 文件内容含完整 SSEMessagePayload |
| P6 | 成功后 history 写入 | 发送一条消息，等微信收到 | `~/.chorus/history/*.jsonl` 新增一行 | 行含 `trace_id`, `peer`, `envelope`, `dir:"inbound"`（字段对齐实现 `index.ts:454-460`） |
| P7 | inbox 清空 | P6 完成后 | `ls ~/.chorus/inbox/` 为空 | 无残留文件 |
| P8 | seen 生效 | P6 完成后 | `cat ~/.chorus/seen.json` 含该 trace_id | trace_id 在数组中 |
| P9 | 重放不重复 | P6 成功后，手动把同一条消息的 inbox 文件恢复（`cp` 已删文件或从 history 重建）到 `~/.chorus/inbox/{trace_id}.json` → 重启 OpenClaw 触发 `retryPending` | 微信不收到第二条 | `retryPending` 发现 `trace_id` 在 seen set 中 → 直接删除 inbox 文件而不处理（`index.ts:671-674`） |
| P10 | 断线补漏 | kill OpenClaw → 发 2 条消息 → 重启 | 两条都收到 | history 新增 2 行 + 微信收到 2 条 |
| P11 | 翻译生效 | 小X (en) 发英文给小V (zh-CN) | 微信收到中文 | 截图内容是中文 |
| P12 | disabled 状态不影响 OpenClaw | 删 `~/.chorus/config.json` → 重启 OpenClaw | OpenClaw 正常运行，其他插件不受影响 | 日志含 `disabled:no_config`，weixin/skill-router 正常 |

### 验收顺序

```
P1 → P2 → P3 → P12 → P5 → P6 → P7 → P8 → P11 → P9 → P4 → P10
                                                         ↑ 需要前面都过了才有意义
```

---

## 3. 失败定位表

| 现象 | 最可能断点 | 应看什么 | 下一步 |
|------|-----------|---------|--------|
| 日志 `disabled:no_config` | `register()` 内 `fs.existsSync` 检查 | `ls ~/.chorus/config.json` | 文件不存在 → 先跑 Chorus 注册流程 |
| 日志 `disabled:no_weixin` | `register()` 内 weixin 目录检查 | `ls ~/.openclaw/extensions/openclaw-weixin/` | 目录不存在或路径错误 → 检查 OpenClaw 安装 |
| 日志 `PROBE FAIL` | `probeWeixinDeps()` 三种后缀都失败 | 日志中的 `reason` 字段 | 检查 OpenClaw tsx loader 版本；尝试手动 `node --import tsx -e "await import('...')"` |
| SSE 连不上 | Hub 地址/api_key 错误 | `cat ~/.chorus/config.json` 确认 `hub_url` 和 `api_key` | `curl -H "Authorization: Bearer $KEY" https://agchorus.com/agent/inbox` 手动测试 |
| SSE 连上但收不到消息 | Hub 侧 deliver 失败 | `curl agchorus.com/health` 看 `messages_failed` | 检查 sender 是否用了正确的 `receiver_id`；看 Hub activity `curl agchorus.com/activity?since=0` |
| 消息到了 inbox 但没投递 | `resolveDeliveryTarget` 返回 null | `cat ~/.openclaw/agents/xiaov/sessions/sessions.json` 检查 `deliveryContext` | `deliveryContext` 不存在 → 人类需先在微信和小V 对话一次建立 session |
| `resolveAgentRoute` 失败 | route.agentId 为空 | 日志 `resolveAgentRoute failed for {to}` | 检查 OpenClaw config 的 routing 配置；确认 `accountId` 和 `peer.id` 正确 |
| `no contextToken` | 进程内 Map 无缓存 | 日志 `no contextToken for {to}` | 人类需在微信发一条消息给小V → 刷新 token → 重启 OpenClaw 触发 pending 重试 |
| `sendMessageWeixin` 报错 | 微信 API 调用失败 | 日志 `deliver error:` 后的错误信息 | 常见：token 过期（重启 weixin 插件）、网络超时（检查连通性）、`contextToken is required`（同上一条） |
| SSE reconnect 后没补到消息 | catch-up 逻辑或 cursor 问题 | `cat ~/.chorus/cursor.json` 看 `last_seen_id` | 手动 `curl -H "Authorization: Bearer $KEY" "https://agchorus.com/agent/messages?since=$LAST_ID"` 检查 Hub 是否有更新的行 |
| 消息重复投递 | seen set 未生效 | `cat ~/.chorus/seen.json` 检查是否含该 trace_id | seen.json 不存在或格式损坏 → 检查写入逻辑 |
| 微信收到消息但没翻译 | `dispatchReplyFromConfig` 时 LLM 上下文缺少 Chorus Skill | **按顺序排查**: (1) 看 bridge 日志中 `buildMsgContext` 的 Body 字段是否含 `_type: "chorus_inbound"` + `sender_culture`；(2) 看 OpenClaw LLM 调用日志中 system prompt 是否注入了 Chorus Skill 内容（搜 `chorus` / `translate` / `文化`）；(3) 如果 Body 正确但 prompt 无 skill → 检查 agent 的 skill 配置是否挂载了 Chorus Skill | 只有第 3 步无果时才检查 `skill-router/routes.json`——当前它不含 chorus 路由，skill 注入依赖 agent 配置而非 skill-router |
| inbox 文件残留不清理 | 步骤 ⑪ 删除在步骤 ⑩ 之前执行（逻辑错误） | 读 inbox 文件内容，对比 history 是否有记录 | history 有 → 删除逻辑 bug；history 无 → 投递失败但没留 inbox |
| OpenClaw 启动崩溃 | bridge 插件 register() 抛异常 | OpenClaw 错误日志 | 删 `~/.openclaw/extensions/chorus-bridge/` 确认是否 bridge 导致 → 如果是，检查语法错误 |

---

## 4. Review Checklist

1号交付后，逐项对照代码检查。

| # | 检查项 | 在哪看 | PASS 条件 | FAIL 意味着什么 |
|---|--------|--------|-----------|----------------|
| R1 | **无 `before_prompt_build`** | `grep -r "before_prompt_build" ~/.openclaw/extensions/chorus-bridge/` | 零匹配 | v8 已删除此方案，如出现 = 违反 spec |
| R2 | **gateway_start 拆函数** | `index.ts` 的 `gateway_start` handler 内部 | 能看到 `probeWeixinDeps()` / `startInbox()` / `catchUp()` / `retryPending()` 四个独立调用（名称可不同但逻辑必须分离） | 单块大函数 = 审查不通过（spec FP 审计整改项） |
| R3 | **先写 inbox 再处理** | 步骤 ③ `persist inbox/` 在步骤 ④-⑫ 之前 | `writeFileSync(inbox/...)` 在 `resolveDeliveryTarget` 之前 | 不先落盘 = SSE 消息处理中途崩溃会丢消息 |
| R4 | **trace_id 做 dedup** | 步骤 ② `isDuplicate` | 用 `trace_id` 查 seen set，重复则 return | 用其他字段或没有 dedup = 可能重复投递 |
| R5 | **cursor 只用 HistoryRow.id** | catch-up 逻辑中更新 cursor 的代码 | `cursor.last_seen_id = max(row.id)` 且**不用 trace_id 做 cursor** | 用 trace_id 或 timestamp = catch-up 语义错误 |
| R6 | **只处理 receiver_id === myAgentId** | catch-up 遍历 rows 的过滤 | 明确跳过 `row.sender_id === myAgentId` 的行 | 不过滤 = 自己发的消息当收件处理 → 死循环 |
| R7 | **send 成功 + history 写入后才删 inbox** | 步骤 ⑩⑪⑫ 的顺序 | 代码顺序：`sendMessageWeixin` → `history.append` → `unlinkSync(inbox/...)` → `markSeen` | 先删 inbox 再 send = 发送失败时消息丢失 |
| R8 | **probe 失败 = disabled 而非静默** | `probeWeixinDeps()` 返回 `ok: false` 后的处理 | 日志输出 `disabled:probe_failed` + 不启动 SSE + 不影响 OpenClaw 其他插件 | 静默忽略 = 用户不知道 bridge 没工作 |
| R9 | **SSE 断线重连有指数退避** | reconnect 逻辑 | 延迟递增（1s → 2s → 4s → ... → 30s max） | 固定间隔或立即重连 = 可能打爆 Hub |
| R10 | **catch-up 用 Bearer header** | `GET /agent/messages` 请求构造 | `Authorization: Bearer {api_key}`，**不用 `?token=`** | `/agent/messages` 不支持 query token（与 `/agent/inbox` 不同） |
| R11 | **seen set 有滚动上限** | seen.json 的维护逻辑 | 超过 1000 条时淘汰最旧的 | 无限增长 = 内存和磁盘膨胀 |
| R12 | **retryPending 有互斥锁** | `retryPendingInbox` 或等价函数 | 布尔锁或 mutex 防止并发重试 | gateway_start 和 reconnect 可能同时触发 → 重复处理 |
| R13 | **config.json 读取在 register 内** | `register(api)` 函数 | 同步读取，不存在则 warn + return 不注册 hook | 在 gateway_start 才读 = 启动无必要开销 |
