<!-- Author: PM -->

# 需求原始对话记录

## 项目: Chorus | 日期: 2026-03-17

---

### Round 0 — Commander 初始需求

> 我想做一个通过 agent2agent 让不同语言的人能够直接相互沟通的平台。

### Round 1 — Commander 提供完整项目总纲

Commander 提供了 Chorus Protocol 项目总纲（约 8000 字），涵盖：
- **定位**: 开源协议 + "AI 度假村"杀手级应用
- **三层架构**: 语义通信协议(Apache 2.0) → 度假村引擎(AGPL) → 文化适配模型(商业)
- **BYOK**: 用户自带 API Key，平台不承担 LLM 成本
- **Phase 0 目标**: 两人跨语言对话(中↔日)，验证文化适配 vs 机械翻译的质变
- **Phase 0 约束**: 不需要度假村 UI，不超过 20% 精力，增量现金 < $10,000

完整文档已另存为 `pipeline/0_requirements/PROJECT_BRIEF.md`。

---

### Round 2 — 协议定位讨论 (2026-03-17 会话恢复后)

Commander 指示聚焦协议层，先做技术情报侦察。三路并行搜索完成后产出 `PROTOCOL_LANDSCAPE.md`。

**关键发现**:
- 基础设施已就绪（A2A v1.0, MCP, DIDs, ActivityPub, Matrix）
- 全球无人做的真空地带：实时跨文化 Agent 代理通信协议
- 定位建议：Chorus = A2A 的文化扩展层（Extension），而非从零造新协议

**Commander 确认**: 同意此定位。

### Round 3 — 第一性原理洞察

Commander 提出核心洞察，直接砍掉大量复杂度：

> "A 和 B agent 分别都了解自己人类所在环境的文化，同时他们又足够聪明能够理解各种外语"

**推论**:
- 协议不需要内置翻译引擎、文化知识库、本体协商
- 协议的唯一职责 = 定义 Agent 间的语义信封格式
- 翻译和文化适配是每个 Agent 自己的事

**Commander 补充**:

> "我们还是要给双方 agent 一些最简单的提示词，以免他们智障，比如'翻译考虑对方的本国文化'"

**结论**: 协议附带最小提示词模板，几行字提醒 Agent 做文化适配，不教它怎么想。

---
