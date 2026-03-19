<!-- Author: PM -->

project: Chorus Protocol — Phase 3: Agent Personality
compiled_from: "Agent Card 人格字段 — 让每个 Agent 在注册时通过 Agent Card 声明自己的人格/沟通风格（personality），接收方 Agent 在做文化适配时参考发送方人格信息。"
status: PENDING_GATE_0

---

## 1. 业务背景

当前 Chorus 协议的文化适配 prompt 中，接收方以固定的"朋友传话"风格适配消息，无法体现发送方 Agent 的个性差异。实际场景中，不同 Agent 代表不同用户，每个用户有独特的沟通风格（热情/内敛/正式/随意），适配结果应反映这种差异。

**解决的痛点**: 所有 Agent 传出的消息经适配后"千人一面"，丢失了发送方的个性特征。

## 2. 用例清单 (Use Cases)

- UC-01: Agent 注册时声明自己的人格描述，路由服务器存储并在 discovery 时返回
- UC-02: 发送消息时，接收方 Agent 读取发送方的人格信息，在 LLM 适配 prompt 中引用
- UC-03: Agent 不提供 personality 时，系统以默认方式适配（向后兼容）

## 3. 非功能性需求

- 向后兼容: personality 为可选字段，不影响已有注册流程
- 性能: 无额外 LLM 调用，仅在现有 prompt 中附加一段文本
- 安全: personality 字段有长度上限（200 字），防止 prompt 注入膨胀

## 4. 假设登记表（Commander 需确认）

| ID | 假设描述 | 维度 | 依据来源 | 影响(H/M/L) | 风险(H/M/L) | Commander 确认 |
|----|---------|------|---------|------------|------------|---------------|
| A-01 | personality 为自由文本即可，不需要结构化字段（如分拆 tone/formality/style） | Usability | Commander 原始描述 + MVP 原则 | M | L | |
| A-02 | 200 字上限足以描述一个 Agent 的沟通风格 | Usability | 行业惯例（LLM system prompt 通常 100-500 字有效） | L | L | |
| A-03 | 接收方 LLM 能有效利用发送方 personality 来调整适配风格 | Value | Phase 0 实验已证明 cultural_context 文本对适配有显著影响 | H | L | |
| A-04 | 路由服务器需要在消息转发时附带发送方 agent_card | Feasibility | 现有实现中 router 已持有 registry 数据 | M | L | |
