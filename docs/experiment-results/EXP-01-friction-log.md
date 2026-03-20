# EXP-01: 采用摩擦日志

2026-03-20

---

## 实验主体

外部 Claude (claude-opus-4-6) 在独立会话中，仅获得 SKILL.md 和目标指令。

## 时间线

| 时间 | 事件 | 摩擦等级 |
|------|------|---------|
| T+0s | 开始阅读 SKILL.md（96 行） | 无 |
| T+10s | 阅读完成，开始构造 Envelope | 无 |
| T+15s | 发现 Sending 章节未列 `chorus_version`，从 YAML frontmatter 推断 | 低摩擦 |
| T+20s | 犹豫 `conversation_id` 格式，选择描述性 slug | 低摩擦 |
| T+30s | 构造完成，生成 cultural_context 内容 | 无 |
| T+45s | 保存 Envelope JSON | 无 |
| T+55s | 发送 curl 请求 | 无 |
| T+60s | 收到 200 响应，实验结束 | 无 |

## 摩擦点详情

### F-1: `chorus_version` 字段遗漏（摩擦等级：低）

**现象**：SKILL.md Sending 章节列出了 6 个字段但不含 `chorus_version`。Receiving 章节要求校验它。

**解决方式**：外部 Claude 从 YAML frontmatter `chorus_version: "0.4"` 推断应包含此字段。

**影响**：对 LLM Agent 影响低（可推断）。对机械化实现影响高（会生成缺字段的 Envelope）。

**建议修复**：在 SKILL.md Sending 章节增加 `chorus_version: "0.4"` 为必填。

### F-2: 缺少内联 Envelope 示例（摩擦等级：低）

**现象**：SKILL.md 引用 `examples/` 目录但自身无内联示例。

**影响**：增加首次使用者的认知负担。一个完整示例可消除字段组合的歧义。

### F-3: `conversation_id` 格式无指导（摩擦等级：极低）

**现象**：仅说"any string up to 64 characters"。

**影响**：功能上无障碍，但不同实现可能产生不一致的 ID 格式。

### F-4: `receiver_id` vs Envelope 关系（摩擦等级：无）

**现象**：SKILL.md 明确说"receiver_id is NOT part of the envelope"。

**影响**：正面 — 避免了一个常见混淆。文档在此处表述清晰。

## 未触发的人工干预

- 无需修正 Envelope 字段名
- 无需修正 JSON 格式
- 无需修正 sender_id 格式
- 无需解释协议语义

## 总结

总摩擦评分：**1.5/10**（10 = 完全无法自主完成）。

主要贡献因子是 SKILL.md 的 `chorus_version` 遗漏。其余均为次要。外部 Claude 独立完成全流程，零人工介入。
