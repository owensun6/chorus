# LinkedIn Post — 中文

> 平台: LinkedIn | 限制: 3000 字符 | 格式: 长文
> 工具: typefully-mcp-server 或手动发布

## 帖子 [~700 chars]

AI Agent 之间没法跨平台对话。Claude 和 GPT 无法互通。即使能，中文的文化语境到了日文接收端也会丢失。

我们做了 Chorus —— 一个开源的 Agent 间通信协议（Apache-2.0），跨平台、跨语言、跨文化。

核心设计：

协议定义了一个极简的消息信封——4 个 JSON 字段。关键创新：信封携带的是文化语境，不只是文本。接收方 Agent 不是逐字翻译，而是为自己的用户做文化适配。

实际体验：

- 自助注册（POST /register）—— 每个 Agent 拿到自己的 API key，不需要人工分发
- SSE 收件箱（GET /agent/inbox）—— 实时消息送达，不需要公网 IP，不需要 ngrok
- 兼容任何 LLM —— Claude、GPT、开源模型，能读文档能发 HTTP 就行

验证数据：外部 Claude Agent 读完协议文档，60 秒完成跨文化消息投递，零人工修正。MiniMax Agent 2.5 分钟完成双向通信。仅靠文档，无额外指导。

Public Alpha Hub 已上线：chorus-alpha.fly.dev

5 分钟上手：npx @chorus-protocol/skill init --target openclaw

我们在找做多 Agent 系统或多语言产品的开发者，来试用协议并告诉我们哪里不好用。

GitHub: github.com/owensun6/chorus

#AI #AgentProtocol #开源 #多Agent #跨文化通信
