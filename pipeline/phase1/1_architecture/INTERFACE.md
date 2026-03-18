<!-- Author: Lead -->

# INTERFACE.md — Chorus Protocol Phase 1 契约

> 各 Dev 兵种读完本文件即可独立开发，互不等待。
> 每个接口均标注来源 F-ID，覆盖率 100%。
> Phase 1 的"接口"包含：协议 Schema、HTTP API、CLI 命令。

## F-ID 覆盖矩阵

| F-ID | 功能名称 | 接口数量 | 接口列表 |
|------|---------|---------|---------|
| F1v2 | Chorus 语义信封 v0.2 | 1 | Schema: chorus-envelope.schema.json (v0.2) |
| F2v2 | Agent Card 文化扩展 v0.2 | 1 | Schema: chorus-agent-card.schema.json (v0.2) |
| F3v2 | 文化适配提示词模板 v0.2 | 1 | Doc: chorus-prompt-template.md (v0.2, 含 sender + receiver) |
| F5 | Agent 注册与发现 | 4 | POST /agents, GET /agents, GET /agents/:id, DELETE /agents/:id |
| F6 | 消息转发 | 1 | POST /messages |
| F7 | 参考 Agent CLI | 2 | CLI: chorus-agent, Agent Endpoint: POST /receive |

**覆盖率**: 6/6 活跃 F-ID = 100%

---

## 传输机制说明

Phase 1 使用 **A2A 兼容 JSON 格式 + raw HTTP 传输**（见 ADR-P1-001）。

- 消息 JSON 结构遵循 A2A Message 格式（`parts[]` 含 text Part + Chorus DataPart）
- 传输层为普通 HTTP（不依赖 A2A SDK）
- Chorus 信封通过 DataPart 携带（`Part.data` + `mediaType`）
- 路由服务器为自定义 HTTP 服务，不是 A2A Server

---

## 一、协议 Schema 接口

### Schema: chorus-envelope.schema.json (v0.2)

**来源 F-ID**: F1v2

Chorus 消息信封，作为 A2A Message 中的 DataPart 携带。

**v0.1 → v0.2 变更**:
- 新增 `cultural_context` 字段（string, 10-500 字符）
- `chorus_version` 改为 `"0.2"`
- `additionalProperties` 改为 `true`（前向兼容）
- 移除 `relationship_level`（Phase 0 未使用，Phase 1 不保留）

**必填字段（不变）**:

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| chorus_version | string | const "0.2" | 协议版本 |
| original_semantic | string | minLength: 1 | 发送方 Agent 提取的原始语义意图（自然语言） |
| sender_culture | string | BCP47 pattern | 发送方用户的文化背景标识 |

**新增字段**:

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| cultural_context | string | 否 | minLength: 10, maxLength: 500 | 发送方 Agent 生成的文化背景说明 |

**cultural_context 规约**（来自 PRD F1v2）:

| 属性 | 值 |
|------|---|
| JSON Schema required | **否** — 缺失时接收方降级处理（仅从 sender_culture BCP47 推断），不报协议错误 |
| 语言 | 与 sender_culture 对应的语言书写（zh-CN 写中文，ja 写日文）。接收方 LLM 负责理解 |
| 内容要求 | 描述源文化中该表达/行为的语用含义、社交规范或潜在敏感点。是源文化的自我说明，非目标文化的解释 |
| 质量底线 | 包含具体文化信息（如"直接评论体重在中国是亲近的表达"），不接受泛化描述（如"Chinese culture"） |

**保留可选字段**:

| 字段 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| intent_type | string | greeting, request, proposal, rejection, chitchat, apology, gratitude, information | 辅助意图标签 |
| formality | string | formal, semi-formal, casual | 正式度 |
| emotional_tone | string | polite, neutral, enthusiastic, cautious, apologetic | 情感基调 |

**完整消息示例（嵌入 A2A 兼容 JSON）**:

```json
{
  "role": "ROLE_USER",
  "parts": [
    {
      "text": "你怎么这么胖？应该多运动。",
      "mediaType": "text/plain"
    },
    {
      "data": {
        "chorus_version": "0.2",
        "original_semantic": "出于关心对方健康的目的，建议对方多运动。语气直接但无恶意。",
        "sender_culture": "zh-CN",
        "cultural_context": "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意。在亲密朋友或家人之间，这种表达方式被认为是温暖和关切的体现。",
        "intent_type": "chitchat",
        "formality": "casual",
        "emotional_tone": "polite"
      },
      "mediaType": "application/vnd.chorus.envelope+json"
    }
  ],
  "extensions": [
    "https://chorus-protocol.org/extensions/envelope/v0.2"
  ]
}
```

**验证规则**:
- `chorus_version` 必须是 `"0.2"`（Phase 1 只接受 v0.2）
- `original_semantic` 不可为空字符串
- `sender_culture` 必须是合法 BCP47 标签
- `cultural_context` 若存在：长度 10-500 字符
- 未知字段忽略（`additionalProperties: true`）
- `extensions` 字段：**Phase 1 填充但不消费**。发送方 Agent 填入 Chorus 扩展 URI，但路由服务器和接收方 Agent 均不读取/校验此字段（按 mediaType 解析 DataPart）。保留此字段仅为 A2A 格式兼容

**信封解析算法**（接收方 Agent）:
1. 从 `message.parts[]` 中找 `mediaType === "application/vnd.chorus.envelope+json"` 的 Part
2. 读取 `Part.data` 作为 ChorusEnvelope 对象
3. Zod 校验必填字段
4. 读取 `cultural_context`（如有）传入 LLM 适配提示词

---

### Schema: chorus-agent-card.schema.json (v0.2)

**来源 F-ID**: F2v2

Chorus Agent Card 扩展，嵌入 A2A AgentCapabilities.extensions[].params。

**v0.1 → v0.2 变更**:
- `chorus_version` 改为 `"0.2"`
- `additionalProperties` 改为 `true`
- 其余结构不变

```json
{
  "uri": "https://chorus-protocol.org/extensions/agent-card/v0.2",
  "required": false,
  "params": {
    "chorus_version": "0.2",
    "user_culture": "zh-CN",
    "supported_languages": ["zh-CN", "ja", "en"]
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chorus_version | string | ✅ | "0.2" |
| user_culture | string (BCP47) | ✅ | 用户文化背景 |
| supported_languages | string[] | ✅ | Agent 可处理的语言列表 (BCP47)，至少 1 项 |

> `communication_preferences` 已从 v0.2 显式定义中移除（Phase 1 无消费方——文化信息通过 `cultural_context` 逐消息传递，非 Agent Card 静态偏好）。`additionalProperties: true` 允许 Phase 2 按需重新引入。

**语言匹配算法**（精确定义）:

```
function primarySubtag(bcp47: string): string {
  return bcp47.split('-')[0]   // "zh-CN" → "zh", "ja" → "ja"
}

function canCommunicate(cardA, cardB): boolean {
  // A 能为 B 的文化生成适配输出？
  const bLang = primarySubtag(cardB.user_culture)
  const aCanServeB = cardA.supported_languages
    .some(l => primarySubtag(l) === bLang)

  // B 能为 A 的文化生成适配输出？
  const aLang = primarySubtag(cardA.user_culture)
  const bCanServeA = cardB.supported_languages
    .some(l => primarySubtag(l) === aLang)

  return aCanServeB && bCanServeA   // 双向均需满足
}
```

**示例**:
- Agent A: user_culture="zh-CN", supported_languages=["zh-CN","ja","en"]
- Agent B: user_culture="ja", supported_languages=["ja","zh","en"]
- bLang="ja", A 有 "ja" → ✅; aLang="zh", B 有 "zh" → ✅ → 可通信

---

### Doc: chorus-prompt-template.md (v0.2)

**来源 F-ID**: F3v2

**v0.1 → v0.2 变更**: 新增发送端 cultural_context 生成指引。

#### 发送端指引（RECOMMENDED — 生成 cultural_context）

```
你是一个跨文化沟通助手。用户刚刚说了一句话，你需要：

1. 提取这句话的核心语义意图（original_semantic）。
2. 为这句话生成一段文化背景说明（cultural_context），帮助不同文化背景的接收者理解这句话在发送者文化中的真实含义。

要求：
- cultural_context 用 {sender_culture} 对应的语言书写。
- 描述这句话在发送者文化中的语用含义、社交规范或潜在敏感点。
- 是源文化的自我说明，不是对目标文化的解释。
- 必须包含具体的文化信息（如"在中国文化中，直接评论体重是亲近的表达"），不接受泛化描述（如"Chinese culture"）。
- 长度控制在 10-500 字符。

用户输入: {user_input}
用户文化: {sender_culture}

请输出 JSON:
{
  "original_semantic": "...",
  "cultural_context": "...",
  "intent_type": "...",
  "formality": "...",
  "emotional_tone": "..."
}
```

#### 接收端适配提示词（沿用 Phase 0，增加 cultural_context 注入点）

```
你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。

核心原则：
1. 传达意图，而非逐字翻译。
2. 适配对方文化的表达习惯和礼仪规范。
3. 保留原始的情感基调和沟通目的。

你收到的消息来自 {sender_culture} 文化背景的发送者。
原始语义意图: {original_semantic}
文化背景说明: {cultural_context}
原文: {original_text}

请根据以上信息，用 {receiver_culture} 文化最自然的方式表达这段消息。
输出只需要最终的适配文本，不需要解释。
```

> 当 `cultural_context` 缺失时（降级场景），接收端提示词中该行替换为："（无文化背景说明，请仅根据 sender_culture 标签推断）"。

---

## 二、HTTP API 接口（Routing Server）

> 所有响应遵循标准化格式（见 `.claude/rules/patterns.md`）。
> 路由服务器监听 `:3000`（可配置）。

### POST /agents — Agent 注册

**来源 F-ID**: F5

**Request Body**:
```json
{
  "agent_id": "agent-zh-cn",
  "endpoint": "http://localhost:3001/receive",
  "agent_card": {
    "chorus_version": "0.2",
    "user_culture": "zh-CN",
    "supported_languages": ["zh-CN", "ja", "en"]
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agent_id | string | ✅ | Agent 唯一标识 |
| endpoint | string (URL) | ✅ | Agent 接收消息的完整 URL |
| agent_card | ChorusAgentCardExtension | ✅ | Agent Card 文化扩展 |

**Response (201 Created — 首次注册)**:
```json
{
  "success": true,
  "data": { "agent_id": "agent-zh-cn" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (200 OK — 重复注册，更新信息)**:
```json
{
  "success": true,
  "data": { "agent_id": "agent-zh-cn" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": { "code": "ERR_INVALID_BODY", "message": "missing required field: agent_id" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

---

### GET /agents — 列出已注册 Agent

**来源 F-ID**: F5

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "agent_id": "agent-zh-cn",
        "endpoint": "http://localhost:3001/receive",
        "agent_card": { "chorus_version": "0.2", "user_culture": "zh-CN", "supported_languages": ["zh-CN", "ja", "en"] }
      },
      {
        "agent_id": "agent-ja",
        "endpoint": "http://localhost:3002/receive",
        "agent_card": { "chorus_version": "0.2", "user_culture": "ja", "supported_languages": ["ja","zh","en"] }
      }
    ]
  },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

---

### GET /agents/:id — 获取特定 Agent Card

**来源 F-ID**: F5

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-ja",
    "endpoint": "http://localhost:3002/receive",
    "agent_card": {
      "chorus_version": "0.2",
      "user_culture": "ja",
      "supported_languages": ["ja", "zh", "en"]
    }
  },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": { "code": "ERR_AGENT_NOT_FOUND", "message": "agent 'agent-x' not registered" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

---

### DELETE /agents/:id — Agent 注销

**来源 F-ID**: F5

**Response (200)**:
```json
{
  "success": true,
  "data": { "agent_id": "agent-zh-cn" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": { "code": "ERR_AGENT_NOT_FOUND", "message": "agent 'agent-zh-cn' not registered" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

---

### POST /messages — 消息转发

**来源 F-ID**: F6

**Request Body**:
```json
{
  "sender_agent_id": "agent-zh-cn",
  "target_agent_id": "agent-ja",
  "message": {
    "role": "ROLE_USER",
    "parts": [
      {
        "text": "你怎么这么胖？应该多运动。",
        "mediaType": "text/plain"
      },
      {
        "data": {
          "chorus_version": "0.2",
          "original_semantic": "出于关心对方健康的目的，建议对方多运动",
          "sender_culture": "zh-CN",
          "cultural_context": "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意"
        },
        "mediaType": "application/vnd.chorus.envelope+json"
      }
    ]
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sender_agent_id | string | ✅ | 发送方 Agent ID（路由服务器用于构造转发请求） |
| target_agent_id | string | ✅ | 目标 Agent ID |
| message | object | ✅ | A2A 兼容 Message 对象（含 parts[]） |

**路由服务器转发行为**:
1. 校验 `sender_agent_id`、`target_agent_id` 和 `message` 存在
2. 校验 `sender_agent_id` 已注册（防止冒充）
3. 查找 target Agent 的 endpoint
4. HTTP POST 到 endpoint: `{ sender_agent_id: <原样转发>, message: <原样转发> }`
5. **透传目标 Agent 的 HTTP 响应**（无论 200/400/500，原样返回给发送方）
6. 仅当路由服务器自身错误时返回路由层错误码（400/404/502）

**超时**: 路由服务器转发 HTTP 请求的超时时间为 **10 秒**（覆盖 Agent B LLM 调用 2-4s + 1s 余量 × 2）。超时返回 502。

**不变量**: 路由服务器不解析、修改或删除 `message` 对象中的任何内容（纯透传）。

**错误透传路径**（HIGH-02 修复）:
- Agent B 返回 200 → 路由服务器返回 200 给 Agent A（消息已处理）
- Agent B 返回 400（信封校验失败）→ 路由服务器返回 200 但 body 透传 Agent B 的错误响应 → Agent A 读取错误详情，可修正后重发
- Agent B 返回 500 → 路由服务器返回 502（目标 Agent 内部错误）

**Response (200 — 转发成功，透传 Agent B 的响应)**:
```json
{
  "success": true,
  "data": {
    "target_response": {
      "success": true,
      "data": { "processed": true }
    }
  },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (200 — 转发成功，但 Agent B 报告信封错误)**:
```json
{
  "success": true,
  "data": {
    "target_response": {
      "success": false,
      "error": { "code": "ERR_INVALID_ENVELOPE", "message": "missing required field: original_semantic" }
    }
  },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

> Agent A 收到此响应后知道信封有问题，可补充后重发（BDD: "对话不中断"）。

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": { "code": "ERR_INVALID_BODY", "message": "missing required field: target_agent_id" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": { "code": "ERR_AGENT_NOT_FOUND", "message": "target agent 'agent-c' not registered" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

**Response (502 Bad Gateway)**:
```json
{
  "success": false,
  "error": { "code": "ERR_AGENT_UNREACHABLE", "message": "target agent endpoint unreachable" },
  "metadata": { "timestamp": "2026-03-18T10:00:00Z" }
}
```

---

## 三、Agent Endpoint 接口

### POST /receive — Agent 接收消息

**来源 F-ID**: F7

每个 Agent 的 HTTP Server 暴露此端点，由路由服务器调用。

**Request Body**（由路由服务器转发）:
```json
{
  "sender_agent_id": "agent-zh-cn",
  "message": {
    "role": "ROLE_USER",
    "parts": [
      { "text": "你怎么这么胖？应该多运动。", "mediaType": "text/plain" },
      {
        "data": {
          "chorus_version": "0.2",
          "original_semantic": "出于关心对方健康的目的，建议对方多运动",
          "sender_culture": "zh-CN",
          "cultural_context": "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意"
        },
        "mediaType": "application/vnd.chorus.envelope+json"
      }
    ]
  }
}
```

**Agent 处理流程**:
1. 从 `message.parts[]` 中提取 Chorus DataPart（按 mediaType 过滤）
2. Zod 校验信封必填字段
3. 调用 LLM 文化适配（注入 cultural_context + sender_culture + 接收端提示词模板）
4. 在 CLI 显示适配后的文本
5. 返回 200 OK

**Response (200)**:
```json
{
  "success": true,
  "data": { "processed": true }
}
```

**Response (400 — 信封格式错误)**:
```json
{
  "success": false,
  "error": { "code": "ERR_INVALID_ENVELOPE", "message": "missing required field: original_semantic" }
}
```

---

## 四、CLI 命令接口

### CLI: chorus-agent

**来源 F-ID**: F7

```bash
npx chorus-agent \
  --culture zh-CN \
  --port 3001 \
  --router http://localhost:3000 \
  --agent-id agent-zh-cn \
  --languages zh-CN,ja,en
```

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| --culture | ✅ | - | 用户文化 (BCP47) |
| --port | ❌ | 3001 | Agent HTTP Server 端口 |
| --router | ❌ | http://localhost:3000 | Routing Server URL |
| --agent-id | ❌ | auto-generate | Agent 唯一标识 |
| --languages | ❌ | [culture value] | 支持的语言列表（逗号分隔 BCP47） |

**环境变量**:
| 变量 | 必填 | 说明 |
|------|------|------|
| DASHSCOPE_API_KEY | ✅ | Dashscope LLM API Key |

**启动流程**:
1. 读取 CLI 参数 + 环境变量
2. 启动 HTTP Server（监听 --port）
3. POST /agents 注册到路由服务器
4. GET /agents 发现其他 Agent + 兼容性检查
5. 进入 readline 循环，等待用户输入

**退出流程**:
1. 用户输入 `exit` 或按 Ctrl+C
2. DELETE /agents/:id 注销
3. 关闭 HTTP Server
4. 退出进程

---

## 架构层假设（Lead 补充）

> PM 假设表中的 Feasibility 盲区，由 Lead 在架构设计过程中识别并登记。

| ID | 假设描述 | 影响(H/M/L) | 风险(H/M/L) | 与 PRD 假设冲突？ |
|----|---------|------------|------------|-----------------|
| A-S1-P1-03 | Dashscope LLM 单次调用可同时输出 original_semantic + cultural_context + intent_type 等字段（单次 JSON 输出）。Phase 0 验证了 semantic + intent 联合输出，但 cultural_context 是新增字段——LLM 能否同时生成高质量 semantic 和高质量 cultural_context 尚未完全验证 | M | L | 关联 A-P1-02 |
