<!-- Author: PM -->
<!-- ⚠️ SUPERSEDED: 本文档已被 pipeline/PRD.md（统一 PRD v2.0）取代。保留为历史记录。 -->

# Phase 1 功能追踪矩阵 (Feature Traceability Matrix)

> 从 Phase 0 的 F1-F4 继承，新增 F5-F8。Phase 0 的 F-ID 以 "v2" 标注更新。

## 追踪总表

| F-ID | 功能名称 | PM | 原型 | 接口 | Task | 实现 | QA | 验收 |
|------|---------|-----|------|------|------|------|-----|------|
| F1v2 | Chorus 语义信封 v0.2（含 cultural_context） | ✅ | N/A | Schema: chorus-envelope.schema.json (v0.2) | T-01, T-02 | | | |
| F2v2 | Agent Card 文化扩展 v0.2 | ✅ | N/A | Schema: chorus-agent-card.schema.json (v0.2) | T-01, T-03 | | | |
| F3v2 | 文化适配提示词模板 v0.2（含 cultural_context 生成指引） | ✅ | N/A | Doc: chorus-prompt-template.md (v0.2) | T-04 | | | |
| ~~F4~~ | ~~三组对比验证实验~~ | - | - | - | - | - | - | **已退休** — Phase 0 验证完成，不纳入 Phase 1 |
| F5 | Chorus 路由服务器 — Agent 注册与发现 | ✅ | N/A | POST/GET/DELETE /agents | T-05 | | | |
| F6 | Chorus 路由服务器 — 消息转发 | ✅ | N/A | POST /messages | T-06 | | | |
| F7 | 参考 Agent 实现（中文 + 日文 CLI） | ✅ | N/A | CLI: chorus-agent, POST /receive | T-07, T-08 | | | |
| ~~F8~~ | ~~协议降级处理~~ | - | - | - | - | - | - | **Phase 1 不实现** — Phase 1 所有 Agent 均为 v0.2，无降级触发场景。Phase 2 引入第三方 Agent 时按需设计 |

---

## 功能详情

### F1v2: Chorus 语义信封 v0.2（协议核心更新）

> 在 Phase 0 的 v0.1 信封基础上，新增 `cultural_context` 字段。这是 Phase 0 实验证明的核心价值字段。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F1v2 | 更新 Chorus 消息信封规范：新增 `cultural_context` 字段，规约如下。保持 v0.1 的 3 个必填字段不变，保留 intent_type/formality/emotional_tone 为可选。Schema 版本升至 v0.2。v0.2 Schema 设置 `additionalProperties: true` 确保前向兼容。 | 规范更新 |

**`cultural_context` 字段规约**（PM 建议值，Lead 在 Stage 1 架构时可调整）：

| 属性 | 值 |
|------|---|
| 字段名 | `cultural_context` |
| 类型 | string |
| JSON Schema required | **否** — 不在 `required` 数组中。缺失时接收方按降级处理（仅从 `sender_culture` BCP47 推断），不报协议错误 |
| 最小长度 | 10 字符（Phase 0 最短有效示例约 15 字符） |
| 最大长度 | 500 字符（超出部分由发送方 Agent 截断） |
| 语言 | 与 `sender_culture` 对应的语言书写。zh-CN 发送方写中文，ja 发送方写日文。接收方 LLM 负责理解任何语言的 cultural_context |
| 内容要求 | 描述源文化中该表达/行为的语用含义、社交规范或潜在敏感点。不应是目标文化的解释，而是源文化的自我说明 |
| 质量底线 | 必须包含具体的文化信息（如"直接评论体重在中国是亲近的表达"），不接受泛化描述（如"Chinese culture"）。发送方 Agent 的提示词模板负责引导 LLM 生成有效内容 |

### F2v2: Agent Card 文化扩展 v0.2

> 微调：确认 Phase 0 定义仍然适用，无重大修改。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F2v2 | 沿用 Phase 0 的 Agent Card 扩展字段（user_culture, supported_languages, communication_preferences）。确认在真实 A2A AgentCapabilities.extensions[].params 中可行。语言匹配规则：Agent A 读取 Agent B 的 Card，检查 B 的 `user_culture` 主语言标签是否在 A 的 `supported_languages` 中——即"A 能否为 B 的文化背景生成适配输出"。双向均需满足。 | 规范确认 |

### F3v2: 文化适配提示词模板 v0.2

> 扩展 Phase 0 的提示词模板，追加 `cultural_context` 生成的推荐指引。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F3v2 | 保留 Phase 0 的接收端适配提示词模板。新增发送端推荐指引：建议 Agent 在封装信封时，由 LLM 根据用户原文 + sender_culture 自动生成 cultural_context 字段内容。此指引为 RECOMMENDED，非 REQUIRED。 | 规范扩展 |

### F5: Chorus 路由服务器 — Agent 注册与发现

> Phase 1 新增。轻量 HTTP 服务，管理 Agent 生命周期。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F5 | 实现 Chorus 路由服务器的 Agent 管理功能：Agent 启动时 POST /agents 注册（携带 endpoint URL + Agent Card）；GET /agents 列出已注册 Agent；GET /agents/:id 获取特定 Agent Card；Agent 退出时 DELETE /agents/:id 注销。内存存储，无持久化，无心跳（Phase 1 为 localhost demo，Agent 进程存在即在线）。 | 新功能 |

### F6: Chorus 路由服务器 — 消息转发

> 核心路由功能。Agent A 发消息给路由服务器，路由服务器转发给 Agent B。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F6 | 实现消息转发：Agent A POST /messages（携带 A2A Message + Chorus Envelope DataPart + 目标 Agent ID）→ 路由服务器查找目标 Agent endpoint → HTTP POST 转发完整消息到目标 endpoint → 返回目标 Agent 的响应。路由服务器不解析/修改 Chorus 信封内容（纯透传）。 | 新功能 |

### F7: 参考 Agent 实现（中文 + 日文 CLI）

> 两个可工作的 CLI Agent，演示 Chorus 协议端到端。

| 编号 | 功能描述 | 操作类型 |
|------|---------|---------|
| F7 | 实现两个参考 Agent（zh-CN Agent + ja Agent），各自为 CLI 程序。启动后自动向路由服务器注册。用户在 CLI 输入消息 → Agent 调用 LLM 提取语义意图 + 生成 cultural_context + 封装 Chorus v0.2 信封 → 发送到路由服务器 → 对方 Agent 接收、解析信封、调用 LLM 文化适配 → 显示给对方用户。双向对话，交替进行。 | 新功能 |

### ~~F8: 协议降级处理~~ — Phase 1 不实现

> FP 删除理由：Phase 1 所有 Agent 均由我们建造，均为 v0.2。不存在"不支持 Chorus"或"使用 v0.1"的 Agent。为不存在的场景写代码 = 浪费。Phase 2 引入第三方 Agent 时再设计降级逻辑。
