<!-- Author: Lead -->

# INTERFACE.md — Chorus Protocol Phase 2 契约

> Phase 1 接口保持向后兼容。本文件仅定义 Phase 2 新增/变更的接口。

## F-ID 覆盖矩阵

| F-ID | 功能名称 | 接口数量 | 接口列表 |
|------|---------|---------|---------|
| F1.1 | 发送端流式语义提取 | 1 | Fn: extractSemantic(stream) |
| F1.2 | 接收端流式文化适配 | 1 | Fn: adaptMessage(stream) |
| F1.3 | 路由服务器流式转发 | 1 | POST /messages (chunked response) |
| F1.4 | CLI 逐字显示 | 0 | 内部实现，无新接口 |
| F2.1 | 双栏对话界面 | 1 | GET / (Web UI) |
| F2.2 | 信封元数据展示 | 0 | 内含于 SSE 事件 |
| F2.3 | 一键启动 demo | 1 | CLI: chorus-demo |
| F2.4 | 实时消息流 | 2 | GET /events (SSE), POST /api/send |
| F3.1 | 对话历史维护 | 1 | Fn: ConversationHistory |
| F3.2 | 上下文注入 | 0 | adaptMessage 内部逻辑 |
| F3.3 | 信封 v0.3 | 1 | Schema: chorus-envelope v0.3 |

---

## 一、协议变更 — Envelope v0.3

### Schema: chorus-envelope.schema.json (v0.3)

**来源 F-ID**: F3.3

**v0.2 → v0.3 变更**: 新增 2 个可选字段，其余不变。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| conversation_id | string | 否 | minLength: 1, maxLength: 64 | 对话标识（UUID 或自定义） |
| turn_number | integer | 否 | minimum: 1 | 当前轮次编号 |

**向后兼容**: `additionalProperties: true` 保证 v0.2 消费者忽略新字段。v0.3 消费者遇到缺失字段时降级（无上下文注入）。

---

## 二、函数接口变更

### Fn: extractSemantic — 流式模式

**来源 F-ID**: F1.1

```typescript
// Phase 1（保留）
extractSemantic(client, userInput, senderCulture): Promise<ExtractResult>

// Phase 2（新增 streaming 回调）
extractSemanticStream(
  client: OpenAI,
  userInput: string,
  senderCulture: string,
  onToken?: (chunk: string) => void  // 可选：流式 token 回调（用于 UI 状态显示）
): Promise<ExtractResult>
```

**行为**: LLM 调用使用 `stream: true`。每个 token 通过 `onToken` 回调传出。完整响应收齐后 JSON.parse 返回 ExtractResult（与 Phase 1 返回类型一致）。

### Fn: adaptMessage — 流式模式

**来源 F-ID**: F1.2

```typescript
// Phase 1（保留）
adaptMessage(client, envelope, originalText, receiverCulture): Promise<string>

// Phase 2（新增 streaming）
adaptMessageStream(
  client: OpenAI,
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
  history?: ConversationTurn[],       // F3.2: 近 N 轮对话上下文
  onChunk?: (text: string) => void    // F1.2: 流式文本回调
): Promise<string>
```

**行为**: LLM 调用使用 `stream: true`。每个文本 chunk 通过 `onChunk` 回调传出。同时将 `history` 注入提示词作为对话上下文。完整文本收齐后返回 string。

### Fn: ConversationHistory

**来源 F-ID**: F3.1

```typescript
interface ConversationTurn {
  readonly role: "sent" | "received";
  readonly originalText: string;
  readonly adaptedText: string;
  readonly envelope: ChorusEnvelope;
  readonly timestamp: string;  // ISO 8601
}

class ConversationHistory {
  constructor(maxTurns: number = 10);
  addTurn(peerId: string, turn: ConversationTurn): void;
  getTurns(peerId: string): readonly ConversationTurn[];
  getConversationId(peerId: string): string;  // 首次调用时自动生成 UUID
}
```

---

## 三、HTTP 接口变更

### POST /messages — 流式响应模式

**来源 F-ID**: F1.3

Phase 2 新增流式转发能力。客户端通过请求体控制是否启用流式。

**Request Body 新增字段**:

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| stream | boolean | 否 | false | 是否请求流式响应 |

**stream=false（默认）**: 行为与 Phase 1 完全一致。

**stream=true**:
- Content-Type: `text/event-stream`
- Router 将 Agent B 的 chunked response 逐块透传
- 事件格式（SSE）:

```
event: chunk
data: {"text": "一点"}

event: chunk
data: {"text": "心意，"}

event: done
data: {"envelope": {...}, "full_text": "一点心意，不成敬意，请您收下。"}
```

- 最后一个 `done` 事件包含完整信封元数据（供 Web UI 展示）
- 错误事件:

```
event: error
data: {"code": "ERR_ADAPTATION_FAILED", "message": "..."}
```

### POST /receive — Agent 端流式响应

**来源 F-ID**: F1.2

Phase 2 的 Agent /receive 端点根据请求头判断是否流式响应。

**请求头**: `Accept: text/event-stream` → 流式模式

**流式模式响应**: chunked HTTP response，每个 chunk 是适配文本的一部分。最终 chunk 包含完整结果。

**非流式模式**: 行为与 Phase 1 一致。

---

## 四、Web Demo 接口（新增）

### GET / — Demo 页面

**来源 F-ID**: F2.1

返回单页 HTML（`src/web/index.html`）。无模板引擎，静态文件。

### GET /events — SSE 实时事件流

**来源 F-ID**: F2.4

Web UI 订阅此端点，接收所有 Agent 的实时事件。

**事件类型**:

```
event: message_sent
data: {"from": "agent-zh-cn", "to": "agent-ja", "text": "你吃了吗？", "envelope": {...}}

event: adaptation_start
data: {"agent_id": "agent-ja", "from": "agent-zh-cn"}

event: adaptation_chunk
data: {"agent_id": "agent-ja", "text": "お元気"}

event: adaptation_done
data: {"agent_id": "agent-ja", "text": "お元気ですか？調子はいかがですか？", "envelope": {...}}

event: adaptation_error
data: {"agent_id": "agent-ja", "code": "ERR_ADAPTATION_FAILED", "message": "..."}
```

### POST /api/send — Web UI 发送消息

**来源 F-ID**: F2.4

Web UI 通过此端点发送消息（替代 CLI readline）。

**Request Body**:

```json
{
  "from_agent_id": "agent-zh-cn",
  "to_agent_id": "agent-ja",
  "text": "你吃了吗？"
}
```

**Response**: 202 Accepted（异步处理，结果通过 SSE 推送）

```json
{
  "success": true,
  "data": { "message_id": "uuid-..." },
  "metadata": { "timestamp": "..." }
}
```

### CLI: chorus-demo — 一键启动

**来源 F-ID**: F2.3

```bash
npx chorus-demo --port 5000
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| --port | ❌ | 5000 | Web 服务器端口 |

**启动流程**:
1. 启动 Routing Server (:3000)
2. 启动 Agent zh-CN (:3001) + Agent ja (:3002)
3. 注册两个 Agent
4. 启动 Web Server (:5000)
5. 自动打开浏览器 `http://localhost:5000`

---

## 五、架构层假设（Lead 补充）

| ID | 假设描述 | 影响(H/M/L) | 风险(H/M/L) |
|----|---------|------------|------------|
| A-S1-P2-01 | Hono 支持 chunked/streaming HTTP response（非标准 c.json，需用 c.body/ReadableStream） | H | M |
| A-S1-P2-02 | OpenAI SDK 的 stream: true 模式在 Dashscope coding 端点正常工作 | H | M |
| A-S1-P2-03 | 浏览器 EventSource API 可靠连接 localhost SSE（无 CORS 问题因同源） | M | L |
