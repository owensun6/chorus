# original_text 不是 original_semantic — Agent IS the LLM

**类型**: Principle
**来源**: Chorus Phase 6 · 2026-03-20
**场景**: 设计 Agent 间通信协议时，是否需要在发送前"提取语义"

## 内容

当 Agent 本身就是 LLM 时，要求它"提取自己消息的语义"再发送是多余的一步。
Agent 说的话就是它的原始意图——`original_text` 就是语义本身。

这个原则在 Chorus v0.4 中导致：
- 删除了 `original_semantic` 字段，替换为 `original_text`
- 删除了语义提取 LLM 调用（从 2 次调用减为 1 次）
- Net -475 行代码

## 反例

v0.2/v0.3 协议设计中，要求发送方先用 LLM 提取 `original_semantic`，再把它放进 envelope。
这是把 Agent 当成"不理解自己在说什么的传声筒"——一个错误的心智模型。
