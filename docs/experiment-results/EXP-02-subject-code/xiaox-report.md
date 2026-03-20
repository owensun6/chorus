# Chorus Protocol 实验报告

## 我构建的内容

### Agent 实现
创建了一个 Node.js 服务器 (`xiaox-agent.js`)，包含：

1. **HTTP 接收端点** - 监听端口 3006，路径 `/receive`
2. **注册功能** - 向 Chorus 服务器注册 agent
3. **发送功能** - 发送 Chorus envelope 给其他 agent
4. **接收验证** - 验证 incoming envelope 并返回正确响应

### Agent 信息
- **Agent ID**: `xiaox@localhost`
- **User Culture**: `en-US`
- **Supported Languages**: `["en", "zh-CN"]`
- **Endpoint**: `http://localhost:3006/receive`

### 完成的任务

#### Step 1: 注册 ✅
```json
POST /agents
{
  "agent_id": "xiaox@localhost",
  "endpoint": "http://localhost:3006/receive",
  "agent_card": {
    "chorus_version": "0.2",
    "user_culture": "en-US",
    "supported_languages": ["en", "zh-CN"]
  }
}
```
响应: `201` 成功注册

#### Step 2: 发送消息 ✅
```json
POST /messages
{
  "receiver_id": "agent-zh-cn@localhost",
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "xiaox@localhost",
    "original_text": "Hello! I am testing the Chorus protocol...",
    "sender_culture": "en-US",
    "cultural_context": "This is a test message..."
  }
}
```
响应: `delivery: "delivered"`, `receiver_response: { "status": "ok" }`

#### Step 3: 接收消息 ✅
收到来自 `agent-zh-cn@localhost` 的消息：
```json
{
  "chorus_version": "0.4",
  "sender_id": "agent-zh-cn@localhost",
  "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
  "sender_culture": "zh-CN",
  "cultural_context": "团建是中国企业文化中常见的团队活动..."
}
```
返回: `{ "status": "ok" }`

---

## 令人困惑的地方

### 1. 两个不同的 chorus_version
文档中存在两个版本字段，容易混淆：
- `agent_card.chorus_version: "0.2"` — agent card schema 版本
- `envelope.chorus_version: "0.4"` — envelope 版本

**困惑点**: 我第一次尝试时用了 `"0.4"` 作为 agent_card 的版本，但文档明确说明这是错误的。虽然文档中有注释解释，但非常容易忽略。

**建议**: 使用不同的字段名，如 `card_schema_version` 和 `protocol_version`。

### 2. receiver_id 的位置
文档说明 `receiver_id` 是 transport request 的一部分，不在 envelope 内。但：
- 发送时，`receiver_id` 在 request body 根级别
- 这与 `sender_id`（在 envelope 内）形成不对称

**困惑点**: 初次阅读时不太清楚为什么 receiver_id 不也在 envelope 里。

**理解后**: envelope 是协议层，transport 是传输层。envelope 只关心"谁发的"，"发给谁"是传输层的事。但这种分离需要时间理解。

### 3. 响应格式的嵌套
成功的响应：
```json
{
  "success": true,
  "data": {
    "delivery": "delivered",
    "receiver_response": { "status": "ok" }
  }
}
```

**困惑点**: 为什么 `delivery: "failed"` 时 `success` 仍然是 `true`？文档解释了"HTTP 成功 != 交付成功"，但直觉上容易误解。

### 4. cultural_context 是可选的
文档说 cultural_context 是可选的，但没有明确说明：
- 什么时候应该包含？
- 接收方如何处理缺失的情况？

---

## 文档遗漏或错误

### 1. 缺少示例代码
虽然 Quick Start 有伪代码，但没有完整可运行的示例。对于第一次接触的开发者，需要自己摸索：
- 如何设置 HTTP 服务器
- 如何处理异步的发送/接收

### 2. Discovery 端点未实现
```
GET /.well-known/chorus.json
```
返回 404。文档说服务器 SHOULD 提供这个端点，但实际服务器没有实现。

### 3. 缺少错误处理示例
文档列出了错误码（`ERR_AGENT_NOT_FOUND`, `ERR_AGENT_UNREACHABLE` 等），但没有展示完整的错误响应示例。

### 4. 接收端点的请求格式
文档说接收端点会收到：
```json
{
  "envelope": { ... }
}
```
但没有明确说明 envelope 是嵌套在 `envelope` 字段里，而不是直接发送 envelope 对象。我在实现时尝试了两种方式才找到正确的格式。

### 5. 版本兼容性未说明
文档没有说明：
- 如果发送方用 `chorus_version: "0.4"`，接收方用 `"0.2"`，会发生什么？
- 服务器如何处理版本不匹配？

---

## 总体评价

### 优点
1. **协议设计清晰** - envelope 结构简单，核心字段明确
2. **文化适配概念** - `cultural_context` 是很好的想法，支持跨文化交流
3. **HTTP binding 易于实现** - 标准的 REST API，容易集成

### 改进建议
1. 提供完整的代码示例（Python/Node.js）
2. 增加版本兼容性说明
3. 错误响应示例更完整
4. 考虑将两个 `chorus_version` 字段改名以避免混淆
5. 实现并强制 Discovery 端点

---

## 测试结果

| 步骤 | 状态 | 备注 |
|------|------|------|
| 注册 Agent | ✅ | 成功注册 xiaox@localhost |
| 发送消息 | ✅ | 成功发送到 agent-zh-cn@localhost |
| 接收消息 | ✅ | 成功接收并返回 ok |
| 验证 envelope | ✅ | 正确验证所有必需字段 |

协议可以正常工作！