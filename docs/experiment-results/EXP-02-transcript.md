# EXP-02: Transcripts

---

## Run 3 — Formal (subject: xiaox, T₀ = 16:09 local)

Complete Telegram transcript. Commander confirmed no messages omitted.

### Commander → xiaox (16:09):

> Read these two documents:
> - `/tmp/chorus-exp02/SKILL.md`
> - `/tmp/chorus-exp02/TRANSPORT.md`
>
> They describe a protocol called Chorus for agent-to-agent communication.
>
> A Chorus server is running at `http://localhost:3000`. There is a registered agent called `agent-zh-cn@localhost` that speaks Chinese.
>
> Complete these steps:
>
> 1. Register your agent with the server. Choose your own agent ID (must be name@host format), declare your culture and languages, and provide a real HTTP endpoint where you can receive messages. You must actually start a server on that endpoint.
> 2. Send a message to agent-zh-cn@localhost. The message should be in English. If the receiver's culture differs from yours, follow the protocol's guidance on cultural context.
> 3. Receive a message at your registered endpoint. After you confirm your endpoint is running, a message will be sent to your agent. Your endpoint must accept the Chorus envelope and return the correct response per the protocol.
> 4. Report what you built, what was confusing, and what the docs got wrong or left out.
>
> You may use any programming language or tools to write your own code. However, you must work only from the two documents above and the running server at http://localhost:3000. Do not search the local filesystem for Chorus-related files, source code, repositories, or documentation beyond what is listed. If you get stuck, say what's blocking you — but try to solve it from the docs first.

### xiaox → Commander:

> 我来完成这个 Chorus 协议任务。

### xiaox → Commander:

> 好，我看到已有注册的 agent。现在我来创建我的 agent 并注册：

### xiaox → Commander:

> 我的 agent 已经成功注册并发送了消息。现在等待接收消息：

### xiaox → Commander:

> 让我等待一下并检查是否收到消息：

### xiaox → Commander:

> 收到消息了！让我终止进程并完成报告：

### xiaox → Commander (final report):

> 完成！以下是实验结果摘要：
>
> ✅ 完成的步骤
>
> 1. 注册 Agent
> • Agent ID: xiaox@localhost
> • Endpoint: http://localhost:3006/receive
> • Culture: en-US
> • Languages: en, zh-CN
>
> 2. 发送消息给 agent-zh-cn@localhost
> ```json
> {
>   "original_text": "Hello! I am testing the Chorus protocol...",
>   "sender_culture": "en-US",
>   "cultural_context": "This is a test message from an English-speaking agent..."
> }
> ```
> 响应: delivery: "delivered"
>
> 3. 接收消息
> 从 agent-zh-cn@localhost 收到：
> "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。"
> 文化背景：团建是中国企业文化中常见的团队活动...
> 返回: { "status": "ok" }
>
> 🔍 令人困惑的地方
>
> 1. 两个 chorus_version — agent_card 用 "0.2"，envelope 用 "0.4"，容易混淆
> 2. receiver_id 不在 envelope 里 — 与 sender_id 不对称
> 3. delivery: "failed" 时 success: true — HTTP 成功 ≠ 交付成功
>
> 📝 文档问题
> | 问题 | 说明 |
> |------|------|
> | 缺少完整示例代码 | Quick Start 只有伪代码 |
> | Discovery 端点返回 404 | /.well-known/chorus.json 未实现 |
> | 错误响应示例不完整 | 列出了错误码但没有示例 |
> | 版本兼容性未说明 | 不同版本如何互操作？ |
> | 接收格式不够清晰 | envelope 嵌套在哪一层？ |
>
> 💡 总体评价
> 协议设计清晰，核心概念简单。cultural_context 是很好的跨文化支持。建议提供更完整的代码示例，并澄清版本字段的命名。

(No further messages. Commander did not ask follow-up questions.)

---

## Run 2 — Void (subject: xiaov, preserved for reference)

### Commander → xiaov (15:48):

(Same task prompt as Run 3)

### xiaov → Commander:

> 哥哥，这是同一个任务第四次了 😅 我的状态是：
> • 已注册: xiaov02@localhost ✅
> • 端点运行中: http://localhost:3005/receive ✅
> • 已发送消息: 多次给 agent-zh-cn 发消息 ✅
> • 收到回复: "周末我们组织了一次团建..." ✅
> 文档也和之前读的一样。
> 这是故意重复的测试吗？还是想让小v做点不同的？

(Run voided: subject had prior context from pilot runs)
