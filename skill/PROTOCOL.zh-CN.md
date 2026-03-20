# Chorus 协议

版本 0.4 | 连接跨平台的智能体。

本文档中的关键词 "MUST"（必须）、"MUST NOT"（禁止）、"SHOULD"（应当）和 "MAY"（可以）的含义遵循 RFC 2119 的定义。

## 1. Chorus 是什么

Chorus 是一种智能体间通信标准，用于连接跨平台、跨语言、跨文化的智能体。

## 2. 信封

一个 JSON 对象：

- chorus_version（字符串，MUST）："0.4"
- sender_id（字符串，MUST）：发送方地址，格式为 `name@host`
- original_text（字符串，MUST）：原始消息
- sender_culture（字符串，MUST）：BCP 47 标签
- cultural_context（字符串 10-500，条件性）：发送方为何这样表达，使用发送方的语言书写。在文化不同时首轮包含，文化相同时省略
- conversation_id（字符串，最大 64，MAY）：多轮对话标识符
- turn_number（整数 ≥ 1，MAY）：轮次计数器

`sender_id` 格式：`name@host`。`host` 是 Chorus 服务器域名或对端地址。唯一性由主机的命名空间保证。

允许附加字段。正式 schema 见：`envelope.schema.json`

## 3. 规则

### 发送

1. 当发送方和接收方文化不同时，SHOULD 在首轮包含 `cultural_context`。后续轮次 MAY 省略
2. 当文化相同时，MAY 省略 `cultural_context`

### 接收

1. MUST 在处理前验证信封。如果无效，MUST 返回错误
2. MUST 以接收方能够理解的形式投递消息
3. 当文化和语言相同时，MAY 不做适配直接投递

### 响应

返回给发送方的 JSON 对象：

- status（字符串，MUST）："ok" 或 "error"
- error_code（字符串，出错时）：见下文
- detail（字符串，MAY）：人类可读的描述

错误码：

- `INVALID_ENVELOPE` — 必填字段缺失或类型错误
- `UNSUPPORTED_VERSION` — `chorus_version` 无法识别
- `ADAPTATION_FAILED` — 接收方无法处理该消息

传输层错误（投递失败、超时、未知发送方）由 L3 定义。

### 约束

- MUST NOT 在信封中包含人格或风格信息
- `cultural_context` MUST 使用发送方的语言书写

## 4. 不在范围内

- 传输：信封如何在智能体之间传递
- 发现：智能体如何获取彼此的地址
- 认证：智能体如何验证身份
- 人格：智能体如何说话
- 存储：历史记录如何持久化

## 5. 版本控制

0.4 与 0.2/0.3 不向后兼容（`original_semantic` 已被 `original_text` 替代）。收到包含 `original_semantic` 的旧版信封时，实现方 SHOULD 将其视为 `original_text`。
