# Thinking 模型的延迟陷阱

**类型**: Pitfall
**来源**: Chorus Protocol Phase 2 — 2026-03-19
**场景**: 选择 LLM 模型用于实时交互场景

## 内容

带 thinking/reasoning 的模型（如 qwen3.5-plus、glm-5、glm-4.7）在实时对话场景中不可用。

横评数据（同一提示词，coding.dashscope.aliyuncs.com）：
- qwen3-coder-next: 1.4s, 0 reasoning tokens
- kimi-k2.5: 2.1s, 0 reasoning tokens
- qwen3.5-plus: 23s, 1218 reasoning tokens
- glm-5: 30s, 936 reasoning tokens

Thinking 模型的 reasoning tokens 占总输出的 80-90%，且无法通过 API 参数禁用（在 coding.dashscope 端点测试了 enable_thinking=false、/no_think tag、chat_template_kwargs，均无效）。

选型规则：实时交互场景必须选 0 reasoning tokens 的模型。先测一个 "说hi" 看 reasoning_tokens 字段。

## 反例

不要假设"更大更新的模型=更好"。qwen3.5-plus 比 qwen3-coder-next 慢 20 倍但质量差距不大。
