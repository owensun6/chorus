# EXP-01: 最小外部集成实验 — 结果总结

2026-03-20

---

## 判定：PASS（有条件）

所有 5 项成功标准通过，但发现 1 项 SKILL.md 文档缺陷。

## 成功标准结果

| # | 标准 | 结果 | 证据 |
|---|------|------|------|
| S-0 | 外部 sender 注册成功 | PASS | HTTP 201, `registered_at: "2026-03-20T04:57:40.087Z"` |
| S-1 | 外部 Claude 在 SKILL.md + 最小任务提示下独立生成合法 Envelope | PASS | Envelope 包含所有必填字段，服务器接受并转发。见 `EXP-01-envelope.json` |
| S-2 | 消息成功送达 zh-CN Agent | PASS | `data.delivery === "delivered"` + `data.receiver_response.status === "ok"` |
| S-3 | zh-CN Agent 产出有效的文化适配文本 | PASS | Agent 日志中 adapted text 为中文，明确警告送钟禁忌并建议替代方案。见 `EXP-01-agent-log.txt` |
| S-4 | 全程无需人工修正 Envelope 格式 | PASS | 外部 Claude 独立构造 Envelope，未经人工修正即被服务器接受 |

## 关键数据

- 外部 Claude 从阅读 SKILL.md 到成功发送：约 60 秒（包含 LLM 生成 cultural_context 的思考时间）
- SKILL.md 阅读量：96 行
- 构造 Envelope 所需的人工提示：0 次（指令中仅给出目标和 HTTP 端点，未给出 Envelope 示例）
- zh-CN Agent 适配延迟：约 5 秒（包含 LLM 调用）

## 发现的问题

### ISSUE-1: SKILL.md Sending 章节未列出 `chorus_version` 字段（MEDIUM）

外部 Claude 报告：SKILL.md 的 Sending 章节列出了 `sender_id`, `original_text`, `sender_culture`, `cultural_context`, `conversation_id`, `turn_number`，但未提及 `chorus_version`。而 Receiving 章节要求校验 `chorus_version`。

外部 Claude 通过推断解决了这个问题（从 YAML frontmatter 中的版本号推断），但对于非 LLM Agent 或机械化实现，这会导致生成的 Envelope 缺少 `chorus_version` 字段。

**建议**：在 SKILL.md 的 Sending 章节明确列出 `chorus_version: "0.4"` 为必填字段。

### ISSUE-2: 缺少内联示例（LOW）

外部 Claude 指出 SKILL.md 引用了 `examples/` 目录但文档本身没有内联示例。一个完整的 Envelope 示例可以消除所有歧义。

### ISSUE-3: conversation_id 格式无指导（LOW）

文档仅说"any string up to 64 characters"，未说明推荐格式（UUID？描述性 slug？）。外部 Claude 选择了描述性 slug，功能上可行。

## 结论

1. **受控环境下技术可达性已验证**：在 SKILL.md + 最小任务提示下，高能力外部 Agent 可在约 60 秒内完成首次受控接入，零人工修正。
2. **demo 栈端到端有效**：zh-CN Agent 准确识别了送钟禁忌并给出了文化适配回复。但此效果由 demo 栈整体产出（含 Agent personality prompt `src/demo/index.ts:68`），不能单独归因为协议增益。
3. **SKILL.md 存在 1 处中等文档缺陷**（Sending 章节遗漏 `chorus_version` 必填字段），需修复以降低非 LLM 实现的接入摩擦。

## 实验局限性

- 这是"受控外部性"实验：外部 Claude 在我们控制的环境中运行，非真实第三方开发者。结论不能外推到真实第三方开发者采纳。
- 外部 Agent 获得了 SKILL.md + 最小任务提示（含 sender_id、receiver_id、HTTP 端点），非"仅凭 SKILL.md"。
- 单向通信：外部 Agent 发送了消息但未接收回复（endpoint 未真正监听）。
- 仅验证 en → zh-CN 单一语言对。
- 外部 Claude 是高能力 LLM，对非 LLM Agent 或能力较弱的 Agent 结论不可外推。
- 文化适配效果来自 demo 栈整体（协议 + Agent LLM + personality prompt），不能单独归因协议增益。
