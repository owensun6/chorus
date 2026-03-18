<!-- Author: Architecture-Consultant -->

# Architecture Consultant Audit Report — Chorus Protocol Phase 1

**审查对象**: Stage 1 架构产出（System_Design, INTERFACE, Data_Models, ADR-P1-001, ADR-P1-002）
**审查基准**: PRD.md, FEATURE_LIST.md, BDD_Scenarios.md
**日期**: 2026-03-18
**角色**: Architecture Consultant（对抗审查视角）

---

## 判定: PASS

**理由**: 无 CRITICAL 级问题。存在 3 项 HIGH 和 5 项 MEDIUM 需 Lead 在后续阶段注意或补充说明，但不阻塞进入 Stage 2/3。

---

## 一、F-ID 覆盖检查（逐条）

| F-ID | INTERFACE.md 覆盖 | 覆盖质量 | 判定 |
|------|-------------------|---------|------|
| F1v2 | Schema: chorus-envelope.schema.json (v0.2) — 字段定义完整，含 cultural_context 规约、验证规则、解析算法 | 充分 | PASS |
| F2v2 | Schema: chorus-agent-card.schema.json (v0.2) — 字段定义 + 语言匹配算法精确定义 | 充分 | PASS |
| F3v2 | Doc: chorus-prompt-template.md (v0.2) — 发送端 + 接收端模板均给出，降级场景有说明 | 充分 | PASS |
| F5 | POST/GET/DELETE /agents — 四个端点均有完整 Request/Response 示例 + 错误码 | 充分 | PASS |
| F6 | POST /messages — 含转发行为描述 + 不变量 + 四种响应码 | 充分 | PASS |
| F7 | CLI: chorus-agent + POST /receive — CLI 参数表 + Agent 端点契约 | 充分 | PASS |
| ~~F4~~ | 已退休 | N/A | N/A |
| ~~F8~~ | Phase 1 不实现 | N/A | N/A |

**覆盖率**: 6/6 活跃 F-ID = 100%。PASS。

---

## 二、发现清单

### HIGH-01: POST /messages 缺少 sender_agent_id — 路由服务器如何知道发送方是谁？

**位置**: INTERFACE.md > POST /messages Request Body

POST /messages 的请求体只有 `target_agent_id` 和 `message`。但路由服务器转发时需构造 `{ sender_agent_id: <发送方 ID>, message: ... }` 发给目标 Agent（System_Design 流程 3 和 INTERFACE.md 的"路由服务器转发行为"步骤 3 均描述了这一点）。

**问题**: 路由服务器从哪里获得 `sender_agent_id`？

- 选项 A: 请求体中增加 `sender_agent_id` 字段 — 简单直接但信任客户端声称的身份
- 选项 B: 基于 HTTP 请求来源 IP:Port 反查注册表 — Phase 1 localhost 下 IP 都是 127.0.0.1，多个 Agent 端口不同，但反查逻辑不在任何文档中

**极端场景**: Agent A 发送消息但在 `sender_agent_id` 字段填入 Agent C 的 ID（身份伪造）。Phase 1 无鉴权，这在 demo 中无影响，但如果不在接口中明确设计这个字段的来源，Dev 兵种会各自猜测。

**建议**: 在 POST /messages 请求体中显式增加 `sender_agent_id` 字段并标注 REQUIRED。Phase 1 信任客户端声称（无鉴权），Phase 2 可增加 token 验证。这是接口定义的完整性问题，不是安全问题。

**严重级别**: HIGH — 接口契约的缺失字段，Dev 无法仅凭 INTERFACE.md 独立实现路由转发逻辑。

---

### HIGH-02: Agent 接收信封校验失败后的行为未完整定义

**位置**: BDD_Scenarios.md > F1v2 Error Case + INTERFACE.md > POST /receive

BDD 场景定义了"信封缺少必填字段时，Agent B 返回格式错误响应...对话不中断，Agent A 可补充后重发"。但这里有两个未闭环的问题:

1. **Agent B 返回 400 给路由服务器 → 路由服务器如何处理？** INTERFACE.md 的 POST /messages 只定义了 200/400/404/502 四种响应。如果目标 Agent 返回 400（信封错误），路由服务器应该透传 400 给发送方，还是包装为另一个状态码？当前文档未说明。

2. **"Agent A 可补充后重发"的用户体验**: Agent A 的 CLI 如何知道消息被拒？需要路由服务器透传 Agent B 的错误详情。当前的 POST /messages 200 响应是 `{ delivered: true }`，没有为"转发成功但目标拒绝"的场景定义响应格式。

**极端场景**: Agent A 的 LLM 抽风生成了无效信封 → 路由服务器成功转发 → Agent B 校验失败返回 400 → 路由服务器？→ Agent A 的用户看到什么？

**建议**: 明确路由服务器对目标 Agent 非 200 响应的处理策略：透传目标 Agent 的响应体（保持纯透传一致性），并在 INTERFACE.md 的 POST /messages 部分补充此场景。

**严重级别**: HIGH — 影响错误恢复路径的 Dev 实现。BDD 场景承诺了"对话不中断"，但接口层未提供支撑。

---

### HIGH-03: POST /receive 的响应体是否应该透传回发送方？

**位置**: INTERFACE.md > POST /messages 转发行为 步骤 4 + System_Design 流程 3

System_Design 流程 3 序列图显示: `AgentB-->>RS: 200 {success: true}` → `RS-->>AgentA: 200 {success: true}`。INTERFACE.md 步骤 4 写"返回目标 Agent 的 HTTP 响应"。

**矛盾**: INTERFACE.md 的 POST /messages 200 响应是固定的 `{ success: true, data: { delivered: true } }`。如果"返回目标 Agent 的 HTTP 响应"是真正的透传，那么 200 响应格式应该是动态的（取决于目标 Agent 返回什么）。如果是固定格式，那"步骤 4: 返回目标 Agent 的 HTTP 响应"的描述与示例矛盾。

**建议**: 明确二选一：
- A: 纯透传（路由服务器原样返回目标 Agent 的响应）— 保持与"不修改内容"的纯透传哲学一致
- B: 路由服务器包装响应（统一格式）— 更可控但需定义更多响应场景

这直接影响 Dev 兵种 `be-api-router` 和 `fe-logic-binder`（Agent 端）的实现。

**严重级别**: HIGH — 接口契约自身矛盾，两个 Dev 兵种可能做出不同假设。

---

### MEDIUM-01: 语言匹配算法的 BCP47 解析粒度可能不足

**位置**: INTERFACE.md > 语言匹配算法

`primarySubtag("zh-CN") → "zh"` 意味着 `zh-CN` 和 `zh-TW` 被视为同一语言。Phase 1 只有 zh-CN 和 ja，不会触发此问题。但算法设计的意图是否就是将简繁体视为同一语言？

**极端场景**: Phase 2 增加 zh-TW Agent。zh-CN Agent 的 supported_languages 含 "zh-CN"，zh-TW Agent 的 user_culture="zh-TW"。`primarySubtag("zh-TW")="zh"`，而 zh-CN Agent 含 `primarySubtag("zh-CN")="zh"`，匹配通过。但 zh-CN Agent 的提示词模板和 cultural_context 可能完全不适用于台湾文化语境。

**建议**: 无需 Phase 1 修改。记录此设计意图为"Phase 1 简化：主标签匹配即可"，Phase 2 如需区分 zh-CN/zh-TW 可引入精确匹配模式。当前行为是合理的——Phase 0 只验证了粗粒度跨文化场景。

**严重级别**: MEDIUM — 不影响 Phase 1，但需要作为已知设计边界记录。

---

### MEDIUM-02: Agent 退出时 DELETE 注销可能丢失（SIGINT 竞态）

**位置**: System_Design > 流程 4: Agent 注销

流程描述: 捕获 SIGINT → DELETE /agents/:id → 关闭 HTTP Server → 退出。

**极端场景**:
1. 用户快速连按两次 Ctrl+C（第二次 SIGINT 在 DELETE 请求发出前到达，进程强制退出）
2. 网络抖动导致 DELETE 请求超时（Phase 1 是 localhost，概率极低但仍存在进程被 kill -9 的场景）
3. Agent 进程崩溃（未捕获异常）— 没有 SIGINT 可捕获

结果: 路由服务器中残留了一个幽灵 Agent 注册。后续消息转发给它将持续返回 502。

**PRD 已知**: PRD 5.5 已记录"Agent 断线后不会自动重新注册"为已知限制。但未提及路由服务器侧的幽灵清理。

**建议**: Phase 1 可接受。两个缓解选项供 Stage 3 任务规划参考：
- A: Agent 重启时使用相同 agent_id，触发 BDD 中已定义的"重复注册更新信息"逻辑，自然覆盖幽灵记录
- B: 路由服务器重启即清空（PRD 已声明无持久化）

选项 A 已被 BDD 覆盖且零额外代码，推荐。

**严重级别**: MEDIUM — 已有自然缓解路径，不需新增功能。

---

### MEDIUM-03: LLM 调用失败的全路径降级未完整串联

**位置**: BDD_Scenarios.md > F3v2 Error Case + INTERFACE.md + System_Design

BDD 定义了"LLM 未能生成 cultural_context → 发送不含 cultural_context 的信封"。但以下场景未串联:

1. **发送方 LLM 完全不可用**（API Key 错误、Dashscope 宕机）: Agent 无法生成 `original_semantic`（必填字段），信封无法构建。BDD 和接口层均未定义此降级路径。用户输入后看到什么？
2. **接收方 LLM 不可用**: Agent B 收到信封但无法调用 LLM 做文化适配。POST /receive 返回什么？500？200 但显示原文？

**建议**: Phase 1 demo 中 LLM 不可用 = 整个系统不可用，简单抛出错误并告知用户"LLM 服务不可用"即可。但建议在 Stage 3 任务规划时为 Agent 的 LLM 调用增加明确的错误处理 Task（而非让 Dev 自由发挥），避免"LLM 超时 → 未处理 Promise rejection → 进程崩溃"。

**严重级别**: MEDIUM — Phase 1 demo 可接受，但需在 task.md 中显式规划错误处理。

---

### MEDIUM-04: `extensions` 字段在 A2A 兼容 JSON 中的必要性未论证

**位置**: INTERFACE.md > Schema: chorus-envelope.schema.json 完整消息示例

消息示例中包含 `"extensions": ["https://chorus-protocol.org/extensions/envelope/v0.2"]`，但：

1. 路由服务器纯透传，不读此字段
2. 接收方 Agent 按 `mediaType` 解析 DataPart，不依赖 `extensions` 字段
3. Data_Models 中 A2AMessage 定义 `extensions` 为 optional

**问题**: 此字段在 Phase 1 的任何处理流程中都没有读取方。它的存在是为了"A2A 格式兼容性"还是有实际运行时用途？如果仅为格式兼容，发送方 Agent 是否有义务填充它？

**建议**: 明确标注 `extensions` 在 Phase 1 中为"OPTIONAL, 填充但不消费"。避免 Dev 花时间实现对此字段的校验逻辑。

**严重级别**: MEDIUM — 不影响功能，但可能浪费 Dev 时间。

---

### MEDIUM-05: 路由服务器 HTTP 转发超时值未定义

**位置**: INTERFACE.md > POST /messages > 502 Bad Gateway

文档定义了 502 响应（目标 Agent 不可达），但未指定路由服务器转发 HTTP 请求的超时值。

**极端场景**: Agent B 的 LLM 调用特别慢（Dashscope 高负载时 > 10s）。路由服务器的 HTTP 转发等到什么时候才判定为"不可达"？PRD 定义单跳 < 5s，但这是端到端延迟目标，不是路由服务器的超时配置。

- 如果路由服务器超时设为 5s：LLM 适配 ~4s + 处理开销 → 可能误判超时
- 如果路由服务器超时设为 30s：用户等待 30s 后才看到错误

**建议**: 在 INTERFACE.md 或 System_Design 中明确路由服务器转发超时值。建议 10s（PRD 5s 延迟目标的 2x buffer），让 Dev 有确定性数字。

**严重级别**: MEDIUM — Dev 会自行选择默认值（可能是库的 60s 默认），不一致。

---

## 三、ADR 审查

### ADR-P1-001: Raw HTTP 替代 A2A SDK

**质疑**: 如果 Phase 2 需要与第三方 A2A Agent 互操作，迁移成本有多大？

**分析**: ADR 声明"只需替换传输层，不需修改业务逻辑"。这是合理的——因为 JSON 格式已经 A2A 兼容。迁移路径清晰：业务逻辑（信封创建/解析/LLM 调用）不变，只需将 `fetch()` 替换为 A2A SDK 的 `sendMessage()`。

**破坏性场景**: A2A SDK 对 `Part.data` 的序列化行为与 raw JSON 不同（如自动 base64 编码）。此时 Phase 1 的信封解析逻辑需要修改。

**判定**: Phase 1 语境下，此决策正确。A-P1-04 的 H×H 风险被完全消除。Phase 2 迁移风险可控（worst case = 调整序列化层）。PASS。

### ADR-P1-002: 单一 Agent 二进制

**质疑**: 无。这是唯一合理的选择。配置差异不值得代码分叉。PASS。

---

## 四、安全盲区探测

Phase 1 为 localhost 内部 demo，PRD 明确排除鉴权。以下为记录性标注，不计入判定：

| 盲区 | Phase 1 风险 | 处置 |
|------|------------|------|
| 无鉴权 — 任何人可注册/注销/发送 | 无（localhost） | Phase 2 必须增加 |
| Agent ID 身份伪造（见 HIGH-01） | 无（2 人 demo） | Phase 2 增加 token |
| endpoint 注入（注册恶意 URL） | 无（localhost） | Phase 2 URL 白名单 |
| 信封注入（超大 cultural_context） | 低（maxLength: 500 已约束） | 已有 Zod 校验 |

**判定**: 安全设计与 Phase 1 scope 匹配。不标记为问题。

---

## 五、总结

| 级别 | 数量 | 编号 |
|------|------|------|
| CRITICAL | 0 | — |
| HIGH | 3 | HIGH-01 (sender_agent_id 缺失), HIGH-02 (信封校验失败透传), HIGH-03 (响应透传 vs 包装矛盾) |
| MEDIUM | 5 | MEDIUM-01 (BCP47 粒度), MEDIUM-02 (SIGINT 竞态), MEDIUM-03 (LLM 全路径降级), MEDIUM-04 (extensions 字段), MEDIUM-05 (转发超时值) |

**三项 HIGH 的共同特征**: 均为 INTERFACE.md 中接口契约的精度不足，会导致 Dev 兵种在实现时做出不同假设。建议 Lead 在进入 Stage 3 任务规划前，在 INTERFACE.md 中补充以下三点的明确约定：

1. POST /messages 请求体增加 `sender_agent_id` 字段
2. 路由服务器对目标 Agent 非 200 响应的处理策略
3. POST /messages 200 响应是固定格式还是透传目标响应

这三项补充预计修改量极小（文档层面），不需要架构重设计。

---

**Architecture Consultant 签字**: 审查完成。PASS（附建议）。
