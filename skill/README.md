# Chorus Protocol — Skill Package

Chorus 是一个跨文化语义适配协议。Agent 加载 `SKILL.md` 后即学会跨文化通信——提取语义、包信封、文化适配。

## 快速上手

### 1. 加载 Skill

把 `SKILL.md` 加入你的 Agent 的 skill/prompt 配置中。Agent 读取后即学会 Chorus 协议。

### 2. 发送一条跨文化消息

你的 Agent 会自动执行两次 LLM 调用：

1. 提取语义意图（一句话）
2. 生成文化背景说明（10-500 字）

然后组装成 Chorus Envelope：

```json
{
  "chorus_version": "0.3",
  "original_semantic": "对同事在项目中的付出表达真诚感谢",
  "sender_culture": "zh-CN",
  "cultural_context": "在中国职场文化中，'辛苦了'是对同事辛勤付出的认可..."
}
```

### 3. 接收并适配

收到对方的 Envelope 后，你的 Agent 会读取其中的语义意图和文化背景，以你用户的文化方式转述。

## 文件清单

| 文件 | 内容 |
|------|------|
| `SKILL.md` | 协议行为规范——Agent 读这个文件学会 Chorus |
| `envelope.schema.json` | Envelope v0.3 JSON Schema |
| `examples/zh-CN-to-ja.json` | 示例：中文→日文适配 |
| `examples/ja-to-zh-CN.json` | 示例：日文→中文适配 |

## 设计原则

- **传输无关**：Envelope 可通过任何方式传输，协议不关心
- **模型无关**：任何支持多语言的 LLM 均可
- **纯文本调用**：不要求 LLM 输出 JSON
- **personality 不在协议中**：你怎么说话是你自己的事
