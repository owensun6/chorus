<!-- Author: Lead -->

# Data Models — Chorus Protocol Phase 2

> Phase 1 实体保留不变。本文件仅定义 Phase 2 新增/变更。

## 变更实体

### 1. ChorusEnvelope v0.3（信封升级）

**v0.2 → v0.3 变更**: 新增 2 个可选字段，chorus_version 改为 "0.3"。

| 字段 | 类型 | 约束 | v0.2 | 说明 |
|------|------|------|------|------|
| chorus_version | string | "0.2" 或 "0.3" | "0.2" only | 允许接收 v0.2 和 v0.3 |
| conversation_id | string? | maxLength: 64 | **新增** | 对话标识 |
| turn_number | integer? | minimum: 1 | **新增** | 当前轮次编号 |

**兼容规则**: Zod schema 的 `chorus_version` 改为 `z.enum(["0.2", "0.3"])`。v0.2 信封仍然有效。

## 新增实体

### 2. ConversationTurn（对话轮次）

Agent 内存中的对话历史记录单元。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| role | string | "sent" \| "received" | 本 Agent 是发送方还是接收方 |
| originalText | string | NOT NULL | 原始文本 |
| adaptedText | string | NOT NULL | 适配后文本 |
| envelope | ChorusEnvelope | NOT NULL | 关联信封（含 cultural_context） |
| timestamp | string (ISO 8601) | NOT NULL | 记录时间 |

### 3. ConversationHistory（对话历史）

每个 Agent 维护的对话历史管理器。

| 属性 | 类型 | 说明 |
|------|------|------|
| conversations | Map<string, ConversationTurn[]> | key = peer agent_id |
| conversationIds | Map<string, string> | key = peer agent_id, value = UUID |
| maxTurns | number | 最大保留轮次（默认 10） |

**存储**: Agent 进程内存
**生命周期**: Agent 启动时创建，退出时销毁
**截断策略**: 超过 maxTurns 时移除最早的 turn（FIFO）

### 4. SSEEvent（Web UI 事件）

SSE 推送给 Web UI 的事件结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| event | string | 事件类型: message_sent, adaptation_start, adaptation_chunk, adaptation_done, adaptation_error |
| data | object | 事件数据（JSON） |

### 5. WebSendPayload（Web UI 发送请求）

POST /api/send 的请求体。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| from_agent_id | string | NOT NULL | 发送方 Agent ID |
| to_agent_id | string | NOT NULL | 目标 Agent ID |
| text | string | NOT NULL, minLength: 1 | 用户输入文本 |

## 实体关系

```
ConversationHistory 1──* ConversationTurn (per peer)
ConversationTurn *──1 ChorusEnvelope (v0.3)
SSEEvent → references ConversationTurn data
WebSendPayload → triggers ConversationTurn creation
```

## 无数据库声明（延续）

Phase 2 延续 Phase 1 的无持久化设计。所有运行时数据为内存存储，重启即清空。
