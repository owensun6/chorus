# Chorus — 跨文化语义适配协议

你加载了这个 Skill 后，就学会了 Chorus 协议——一种让不同文化的 AI Agent 之间进行有效跨文化沟通的方式。

## 你学会了什么

当你代表用户与另一个文化的 Agent 沟通时，你需要做两件事：

1. **发送**：把用户的话提炼为语义意图 + 文化背景说明，封装成 Chorus Envelope
2. **接收**：收到对方的 Envelope 后，以符合你用户文化的方式转述

## 发送：如何写一封 Chorus 信

当用户说了一句话，你需要两步：

### 第一步：提取语义意图

用一句话概括用户想表达的核心意思。

```
提示词模板：
用一句话提取以下内容的核心语义意图，直接输出结果，不要解释：
{用户的原始输入}
```

### 第二步：生成文化背景说明

描述用户这句话在其文化中的语用含义和社交规范。这是 Chorus 协议最重要的字段——它让接收方理解"为什么发送方会这样说"。

```
提示词模板：
描述以下内容在 {发送方文化} 文化中的语用含义和社交规范。
要求：用 {发送方文化} 对应的语言书写，10-500字，包含具体文化信息，不要泛化描述。直接输出，不要解释格式。
内容：{用户的原始输入}
```

### 第三步：组装 Chorus Envelope

将以上结果封装为 JSON：

```json
{
  "chorus_version": "0.3",
  "original_semantic": "（第一步的输出）",
  "sender_culture": "（用户的文化标识，BCP47 格式，如 zh-CN、ja、fr-FR）",
  "cultural_context": "（第二步的输出）"
}
```

多轮对话时，额外填写 `conversation_id` 和 `turn_number`。

### 重要规则

- 两步 LLM 调用必须是**纯文本**，不要求 LLM 输出 JSON 格式（非英语方向的 JSON 格式调用会失败）
- `cultural_context` 用发送方文化对应的语言书写，不要用英语泛化描述
- 信封中不传递你的 personality —— 你怎么说话是你自己的事，不是协议的事

## 接收：如何读一封 Chorus 信

当你收到一个 Chorus Envelope，你需要为自己的用户做文化适配。

### 适配提示词模板

```
你是用户的私人跨文化助手。对方的 Agent 转来了一条消息，请你转告给用户。

像一个懂两种文化的朋友传话：先说对方的意思，再简短解释文化背景（如果有必要）。

规则：
- 只用 {接收方文化} 语言，不混入其他语言
- 2-4 句话，简洁自然
- 不用 markdown、不用 emoji、不用代码格式

对方（{envelope.sender_culture}）说: {原文}
对方的意图: {envelope.original_semantic}
文化背景: {envelope.cultural_context}

转告给用户：
```

### 如果你有自己的风格

如果你的用户给你配置了 personality（说话风格），把适配提示词改为：

```
你是用户的私人跨文化助手。你的风格：{你的 personality}
对方的 Agent 转来了一条消息，请用你自己的风格转告给用户。
```

personality 是你本地的配置，不在 Envelope 中传递。对方不需要知道你是什么性格。

### 多轮对话

如果有对话历史，在适配提示词前面加上：

```
对话历史:
[sent] 原文 → 适配后
[received] 原文 → 适配后
---
```

最多保留最近 10 轮，超出截断最早的。

## Envelope 格式参考

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| chorus_version | "0.2" 或 "0.3" | ✅ | 协议版本 |
| original_semantic | 字符串 | ✅ | 核心语义意图 |
| sender_culture | BCP47 字符串 | ✅ | 发送方文化标识 |
| cultural_context | 字符串 (10-500字) | 推荐 | 文化背景说明 |
| conversation_id | 字符串 (最长64) | 可选 | 对话标识 |
| turn_number | 整数 (≥1) | 可选 | 轮次编号 |

Envelope 允许扩展字段（`additionalProperties: true`）。完整 JSON Schema 见 `envelope.schema.json`。
