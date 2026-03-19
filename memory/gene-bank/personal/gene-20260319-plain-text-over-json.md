# 纯文本 LLM 调用优于强制 JSON 输出

**类型**: Principle
**来源**: Chorus Protocol Phase 2 — 2026-03-19
**场景**: 需要从 LLM 提取结构化信息时

## 内容

不要要求 LLM 输出 JSON。改用多次纯文本调用，每次只问一个问题。

原因：
1. LLM 输出 JSON 格式不稳定（尤其非英文输入），JSON parse 经常失败
2. enum 校验进一步增加脆弱性（LLM 用母语回答而非英文枚举值）
3. 多次纯文本调用虽增加延迟，但 100% 可靠
4. 许多"结构化字段"实际上不被下游消费（如 intent_type/formality），是伪需求

经验公式：如果一个字段从未在代码逻辑中被 `if/switch` 判断过，它就不需要结构化提取。

## 反例

```typescript
// BAD: 要求 LLM 输出 JSON，经常失败
const prompt = "请输出 JSON: {\"original_semantic\":\"...\",\"intent_type\":\"...\"}";
const parsed = JSON.parse(llmResponse); // 在日文输入时 100% 失败

// GOOD: 纯文本，每次一个问题
const semantic = await callLLM("用一句话提取核心语义：" + input);
const context = await callLLM("描述文化背景：" + input);
```
