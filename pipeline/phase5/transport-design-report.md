# TRANSPORT.md 设计报告

> 供 Commander + 专家团讨论用

---

## 1. 目的 (Purpose)

Chorus 协议有 L1（PROTOCOL.md — 信封格式）和 L2（SKILL.md — 使用指南），但缺 L3（传输层 — 信封如何从 A 到达 B）。

类比：有 RFC 5322（邮件格式）但没有 RFC 5321（SMTP）。Agent 知道怎么包信封，但不知道怎么投递。

**TRANSPORT.md 要回答一个问题**：一个 Chorus agent 如何把信封送到另一个 agent？

---

## 2. 研究 (Research)

### 2.1 行业协议的传输层设计

调研了 5 个成熟通信协议，聚焦传输层与消息层的分离方式。

| 协议 | 传输绑定 | 是否硬编码路径 | 发现机制 | 注册方式 | 响应格式 |
|------|---------|--------------|---------|---------|---------|
| **SMTP** | TCP + 命令词汇 | N/A（EHLO/MAIL FROM/DATA） | DNS MX 记录 | 无（DNS 隐式） | 3 位数字码 + 文本 |
| **XMPP** | TCP + XML 流 | N/A（stanza 类型） | DNS SRV 记录 | 带内 `<iq>` 注册 | `<iq type="result\|error">` |
| **Matrix** | HTTP + REST | **是**（`/_matrix/client/v3/...`） | `/.well-known/matrix/server` | `POST /_matrix/.../register` | JSON `{errcode, error}` |
| **A2A** | HTTP + JSON-RPC 2.0 | **否**（单一端点 + 方法分发） | `/.well-known/agent.json` | 无（声明 Agent Card） | JSON-RPC `{result}` / `{error}` |
| **ActivityPub** | HTTP POST | **否**（Actor 声明自己的 inbox URL） | `/.well-known/webfinger` | 无（WebFinger + Actor 文档） | HTTP 状态码（201/202） |

### 2.2 关键模式总结

**路径硬编码 vs 抽象操作**：5 个协议中只有 Matrix 硬编码路径。SMTP/XMPP 用命令词汇，A2A 用 JSON-RPC 方法名，ActivityPub 让 Actor 自声明。行业主流是**不硬编码路径**。

**发现机制**：现代协议统一用 `/.well-known/`（Matrix、A2A、ActivityPub）。老协议用 DNS（SMTP MX、XMPP SRV）。

**传输包装**：所有协议都在消息内容外加传输信封。SMTP 的 FROM/TO 与消息体分离；A2A 的 JSON-RPC 信封包裹操作；ActivityPub 的 Activity 包裹 Object。

**地址格式**：`name@host` 是 SMTP 和 XMPP 的通用模式。`host` 用于路由，`name` 用于寻址。Chorus 的 `sender_id` 格式 (`name@host`) 直接契合。

### 2.3 A2A 与 Chorus 的层次对称

| A2A 层次 | Chorus 层次 | 内容 |
|---------|-----------|------|
| L1: Data Model（Protobuf 定义） | L1: PROTOCOL.md（Envelope JSON 定义） | 数据格式 |
| L2: Operations（抽象操作：SendMessage, GetTask） | L2: SKILL.md（使用指南：发送、接收规则） | 语义操作 |
| L3: Transport Binding（JSON-RPC / gRPC 映射） | L3: TRANSPORT.md（**待写**） | 传输绑定 |

### 2.4 Chorus 参考实现现状

已有可运行的实现（`src/server/` + `src/agent/`），端点如下：

**Server（路由中继）**：
- `POST /agents` — 注册（agent_id + endpoint + agent_card）
- `GET /agents` — 列出所有 agent
- `GET /agents/:id` — 查询单个
- `DELETE /agents/:id` — 注销
- `POST /messages` — 投递（sender_agent_id + target_agent_id + A2A message）
- `GET /health` — 健康检查

**Agent（接收端）**：
- `POST /receive` — 接收消息（sender_agent_id + A2A message）

**响应格式**（Transport 层）：
```json
{ "success": true, "data": {...}, "metadata": { "timestamp": "..." } }
{ "success": false, "error": { "code": "ERR_...", "message": "..." }, "metadata": { "timestamp": "..." } }
```

**注意**：参考实现将 Chorus envelope 包裹在 A2A message 的 DataPart 中（`application/vnd.chorus.envelope+json`），不是直接传裸 envelope。

---

## 3. 推断 (Inference)

### 推断 1：TRANSPORT.md 应定义抽象操作 + HTTP 绑定

不硬编码路径到标准里。定义 4 个抽象操作，再给出一个 HTTP 绑定作为默认实现。

**理由**：
- 行业主流做法（A2A、ActivityPub、SMTP 都不硬编码路径）
- 未来可扩展其他传输绑定（WebSocket、gRPC）而无需修改标准
- 参考实现的路径选择是实现决策，不应成为协议约束

**4 个抽象操作**：

| 操作 | 方向 | 输入 | 输出 |
|------|------|------|------|
| Register | Agent → Server | sender_id, endpoint, capabilities | 确认 |
| Unregister | Agent → Server | sender_id | 确认 |
| Discover | Agent → Server | (可选过滤) | Agent 列表 |
| Send | Agent → Server 或 Agent → Agent | receiver_id, envelope | 投递结果 |

### 推断 2：标准应传裸 envelope，A2A 包装是 MAY

参考实现把 envelope 包在 A2A message 里，是因为它同时想兼容 A2A 生态。但 Chorus 作为独立协议，`send` 操作的 payload 应该是 `{ receiver_id, envelope }`，不强制 A2A 包装。

**理由**：
- 降低最小实现门槛（不需要理解 A2A 就能实现 Chorus 传输）
- 保持协议独立性
- A2A 兼容可以在 TRANSPORT.md 中作为"扩展"或"MAY"说明

**但有一个反面论点**：参考实现已经用 A2A 包装了。如果标准定义裸 envelope，参考实现就不符合标准的"默认" HTTP 绑定。需要决定是改实现还是改标准。

### 推断 3：发现机制用 `/.well-known/chorus.json`

遵循行业惯例。一个 Chorus server 在 `/.well-known/chorus.json` 声明自己的能力和端点。

```json
{
  "chorus_version": "0.4",
  "endpoints": {
    "register": "/agents",
    "discover": "/agents",
    "send": "/messages"
  }
}
```

这样即使路径不同，客户端也能通过 well-known 发现正确端点。

### 推断 4：两种连接模式需明确定义

| 模式 | 流程 | 适用场景 |
|------|------|---------|
| **Server-Relay** | Agent A → Chorus Server → Agent B | 默认模式，agent 注册到共享服务器 |
| **P2P Direct** | Agent A → Agent B（直连） | 两个 agent 已知彼此端点 |

Server-Relay 需要 Register + Discover + Send 三步。
P2P Direct 只需要 Send 一步（直接 POST 到对方端点）。

### 推断 5：Transport 响应 vs Protocol 响应应分层

| 层 | 格式 | 告诉你什么 | 已定义？ |
|----|------|----------|---------|
| Transport 层 | HTTP 状态码 + `{ success, data/error }` | "你的请求是否成功送达" | TRANSPORT.md 定义 |
| Protocol 层 | `{ status, error_code, detail }` | "你的消息是否被理解和处理" | PROTOCOL.md 已定义 ✓ |

PROTOCOL.md 已说 "Transport-level errors are defined by L3"，这正是 TRANSPORT.md 的责任。

---

## 4. 疑问 (Open Questions)

### Q1：裸 envelope vs A2A 包装？

标准的 `send` 操作传什么？

- **选项 A**：裸 envelope（`{ receiver_id: "bob@server", envelope: {...} }`）
  - 优：简单、独立、门槛低
  - 劣：与参考实现不一致，需改实现或在实现里做兼容层

- **选项 B**：A2A message（envelope 作为 DataPart）
  - 优：与参考实现一致，兼容 A2A 生态
  - 劣：引入 A2A 依赖，提高最小实现门槛

- **选项 C**：标准定义裸 envelope 为 MUST，A2A 包装为 MAY（实现可选）
  - 优：标准简洁，同时允许 A2A 兼容
  - 劣：参考实现默认走 A2A 路径，与标准的 MUST 不一致

### Q2：TRANSPORT.md 应该有多厚？

- **薄标准**：只定义 4 个抽象操作 + 数据格式，不给 HTTP 绑定。类似 A2A 的 L2。
  - 风险：太空泛，不可操作，无法直接照着实现

- **厚标准**：抽象操作 + 完整 HTTP 绑定 + JSON 示例 + 错误码表。
  - 风险：可能过度规范，限制实现自由

- **中等**：抽象操作 + HTTP 绑定（标为"默认绑定"），带 JSON 示例。
  - 平衡：可操作且留有扩展空间

### Q3：`/.well-known/chorus.json` 是否纳入 TRANSPORT.md？

参考实现没有这个。是否值得现在引入？

- 引入：遵循行业最佳实践，为未来多服务器/联邦化铺路
- 不引入：当前只有一个参考服务器，过早优化

### Q4：receiver_id 的格式是否需要进一步规范？

PROTOCOL.md 定义了 `sender_id` 格式为 `name@host`。`receiver_id` 在传输层使用，是否也用同样格式？

参考实现里 `target_agent_id` 只是一个 string（如 `"bob"`），没有 `@host` 部分——因为所有 agent 都注册在同一个 server 上，host 是隐含的。

跨服务器场景下，receiver_id 需要 `name@host` 格式来路由。是否现在就规范，还是留给未来联邦化？

### Q5：Streaming 是否纳入标准？

参考实现支持 SSE streaming（`POST /messages` 带 `stream: true`）。这是传输层关注点。

- 纳入：完整性好，streaming 在实际 agent 通信中很常见
- 不纳入：增加标准复杂度，可作为扩展

---

## 附：建议的文档结构草案

```
# Chorus Transport

Version 0.4 | L3 — How envelopes travel between agents.

## 1. Scope
  - Transport 的职责边界（做什么、不做什么）
  - 与 PROTOCOL.md (L1) 和 SKILL.md (L2) 的关系

## 2. Connection Modes
  - Server-Relay（通过 Chorus Server 中继）
  - P2P Direct（agent 间直连）

## 3. Operations
  - Register / Unregister / Discover / Send
  - 每个操作的输入、输出、错误条件

## 4. HTTP Binding (Default)
  - 路径映射
  - 请求/响应 JSON 格式
  - 错误码表

## 5. Agent Endpoint
  - 接收端暴露的端点
  - 请求/响应格式

## 6. Error Codes
  - Transport-level 错误码（与 PROTOCOL.md 的 protocol-level 错误码分开）
```
