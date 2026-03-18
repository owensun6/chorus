<!-- Author: Lead -->

# ADR-001: 基于 A2A DataPart 传输信封，Agent Card 使用 params 扩展

## 背景（Context）

Chorus 需要在 A2A 消息中携带结构化信封数据。初始设计假设 `Message.extensions` 支持嵌套 JSON 对象，经 Architecture Consultant 审查证实 `Message.extensions` 是 `repeated string`（URI 列表），不支持数据载荷。

## 考虑的选项（Options）

| 选项 | 优点 | 缺点 |
|------|------|------|
| A: Message.metadata (Struct) | 支持任意嵌套 JSON；标准字段 | 语义上 metadata 是辅助信息，非消息主体 |
| B: Part.data (DataPart) | A2A v1.0 正式支持；语义上是消息的一部分；可用 mediaType 标识 | 需要接收方按 mediaType 过滤 |
| C: Fork A2A 消息格式 | 完全自由 | 与 A2A 生态脱钩 |

## 决策（Decision）

选择 **B: DataPart**。

**原因**:
- Chorus 信封是消息内容的一部分（语义意图），不是元数据
- DataPart 的 `mediaType` 字段提供了干净的类型标识（`application/vnd.chorus.envelope+json`）
- 接收方过滤 parts 按 mediaType 查找 Chorus 信封，逻辑清晰
- `Message.extensions[]` 仍可用于声明 Chorus 扩展 URI（仅标识用途）
- Agent Card 扩展使用 `AgentCapabilities.extensions[].params`（Struct 类型，支持嵌套）

**降级方案**: 若 DataPart 在某些 A2A 实现中不支持，可回退到 Message.metadata。

## 后果（Consequences）

- 正向: 完全合规 A2A v1.0 规范；语义清晰
- 负向: 接收方需要遍历 parts 数组查找 Chorus DataPart
- 被拒方案: metadata（语义不精确）、fork（违反 FP "删除冗余"）
- 历史修正: 初版设计中的 `extensions[{data}]` 嵌入方式已纠正
