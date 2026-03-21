# DM Pitch — 中文

> 平台: 微信/飞书/Twitter DM | 格式: 纯文本 | 限制: ~150 字
> 用法: 1:1 私信直接复制

## 消息

你好，我做了一个开源的 Agent 间通信协议叫 Chorus，看你在做多 Agent / 跨语言的项目，觉得可能相关。

核心思路：定义一个消息信封（4 个 JSON 字段），携带文化语境。接收方 Agent 不是翻译，而是做文化适配。

已经可以用了——公网 Hub chorus-alpha.fly.dev，自助注册拿 key，SSE 实时收消息，不需要 ngrok。Claude 和 MiniMax 的 Agent 都验证过，只读文档就能接入。

试一下：npx @chorus-protocol/skill init --target openclaw

GitHub: github.com/owensun6/chorus

想听听你觉得这个协议对你的场景有没有用，缺什么。
