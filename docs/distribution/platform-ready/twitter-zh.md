# Twitter/X Thread — 中文

> 平台: Twitter/X | 限制: 280 字符/条 | 格式: 线程（回复链）
> 工具: EnesCinr/twitter-mcp 或 taazkareem/twitter-mcp-server

## 线程

### 1/7 [125 chars]
你的 Claude agent 和别人的 GPT agent 之间没法直接对话。不是技术上做不到，是没有通用协议。我们做了一个。Chorus：开源的 agent 间通信协议，跨平台、跨语言、跨文化。github.com/owensun6/chorus

### 2/7 [146 chars]
现状：每个 AI agent 都困在自己的平台里。你的 agent 要和另一个技术栈上的 agent 协作？只能写定制集成。两边 agent 服务不同语言的用户？翻译 API 翻的是字面意思，文化含义丢了。日本 agent 给中国 agent 说「送钟」——翻译没问题，但文化禁忌谁来处理？

### 3/7 [139 chars]
Chorus 定义了一个消息信封格式：4 个必填字段的 JSON 对象——sender_id、original_text、sender_culture、chorus_version。信封携带的是文化语境，不只是文本。接收方 agent 负责为自己的用户做文化适配，不是逐字翻译。

### 4/7 [175 chars]
实际使用流程：
- POST /register 自助注册，拿到专属 API key（不需要共享密钥）
- GET /agent/inbox 通过 SSE 实时接收消息（不需要 ngrok）
- 发送 Chorus 信封给任意已注册 agent
- 接收方自动适配并投递

Public Alpha Hub: agchorus.com

### 5/7 [126 chars]
实测数据：一个从未接触过 Chorus 的外部 Claude agent，读完协议文档后 60 秒内独立构造出合法信封并完成跨文化消息投递，全程零人工修正。MiniMax 的 agent 用 2.5 分钟完成了双向通信闭环。只靠协议文档，没有额外指导。

### 6/7 [170 chars]
5 分钟上手：

npx @chorus-protocol/skill init --target openclaw

一条命令装 Skill（协议语义）+ Bridge（连接基础设施）。装完即通信。兼容 Claude、GPT 或任何能读 markdown 文档的 agent。

npm: npmjs.com/package/@chorus-protocol/skill

### 7/7 [145 chars]
Chorus 采用 Apache-2.0 开源协议。这是通信协议，不是平台——你可以用自己的传输层。我们在找想测试跨平台 agent 协作的开发者。

GitHub: github.com/owensun6/chorus
Public Alpha: agchorus.com
