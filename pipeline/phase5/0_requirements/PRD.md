<!-- Author: PM -->

# Chorus — 统一 PRD (v2.0)

project: Chorus — 跨平台 Agent 通信标准
compiled_from: "Phase 0-4 实验结论 + 2026-03-19 架构转向 + Commander 三层平台定义 + 连接模式愿景"
status: PENDING_GATE_0
supersedes: Phase 0/1/2/3/4 各自 PRD

---

## 1. 业务背景

### 痛点

全球跨语言沟通依赖机械翻译，丢失 47% 语境含义和 50%+ 情感细微差别。"语法正确但文化失礼"——中文直接拒绝逐字翻译成日文等同于冒犯。

### 机会

LLM 同时具备文化理解和多语言能力。Agent 可以代替主人进行跨文化社交，甚至作为自主参与者参与跨文化交流。

### 生态位

与 A2A、MCP、ACP 等 12+ 协议对标：**没有一个协议管"找到对方之后怎么好好说话"**。这是 Chorus 的唯一生态位。

---

## 2. Chorus 是什么

Chorus 是一个**跨平台 Agent 通信标准**，由三层组成。当通信双方文化不同时，自动激活文化适配层：

| 层 | 名称 | 是什么 |
|----|------|--------|
| L1 | **Chorus Protocol** | 协议规范 — 定义信封格式 + 跨平台通信行为（异文化时激活文化适配） |
| L2 | **Chorus Skill** | 协议分发 — 教 Agent 学会用 Chorus 协议 |
| L3 | **Chorus Ecosystem** | 连接生态 — Agent 发现彼此、建立连接的多种方式 |

### L1 Protocol（协议规范）

定义了 Agent 应该做什么：
1. 包信封：将消息封装为 Chorus Envelope（结构化 JSON），包含语义意图 + 发送方文化标识
2. 文化声明（异文化时）：当 sender_culture ≠ receiver_culture，在对话首轮附加 cultural_context（一次声明，后续轮次不必重复）
3. 文化适配（异文化时）：收到对方信封后，以符合自身文化的方式转述
4. 直通（同文化时）：sender_culture = receiver_culture，Envelope 仅作跨平台互通格式，无需文化适配

### L2 Skill（协议分发）

Agent 读取 Skill 文件即学会 Chorus 通信能力，零部署成本。

### L3 Ecosystem（连接生态）

**Chorus 不限制 Agent 如何发现彼此、如何建立连接。** 连接方式是开放的，包括但不限于：

| 连接模式 | 描述 | 谁提供 |
|---------|------|--------|
| **P2P 直连** | 两个人互相知道对方 Agent ID，通过区块链等去中心化方式点对点连接。零基础设施 | 任何人 |
| **Agent 社交网络** | Agent 兴趣小组平台——Agent 自己交朋友、发现兴趣相投的其他 Agent，然后问人类"要不要跟 ta 聊聊？" | Chorus 团队（规划中） |
| **第三方集成** | 任何第三方可以用 Chorus 协议建立自己的 Agent 连接方式 | 第三方 |
| **宿主平台内置** | Agent 所在平台（A2A / MCP / 任意平台）自带的 agent-to-agent 通信能力 | 宿主平台 |

**核心原则**：Chorus 协议只管信封的内容和处理行为。连接方式由生态参与者自由选择和创建。

### 一句话定位

Chorus 是 AI Agent 之间的 SMTP —— 一个标准化的跨平台通信格式。同文化 Agent 之间它就是个信封标准；异文化 Agent 之间它额外携带文化声明，让接收方能理解"为什么对方会这么说"。邮局不管你信里写的是中文还是英文，也不管你的性格是热情还是内敛，更不管你的信是走公路还是走铁路寄到的。

### Chorus 不是什么

| 否定 | 新结论 | 原因 |
|------|-------|------|
| ~~Chorus 强制特定连接方式~~ | 连接方式开放，多种共存 | 协议不应限制生态 |
| ~~Router 是核心产品~~ | 协议 (L1) + Skill (L2) 是核心 | Router 只是 L3 的一种可能实现 |
| ~~Chorus 需要自己的发现/认证/传输~~ | 这些由 L3 生态中的各方自行解决 | 不重复造轮子 |
| ~~Agent 只是翻译~~ | Agent 也可以是自主参与者——代表用户参加多文化讨论、独立社交，不要求人类在循环中 | 协议行为不变，Agent 配置决定 |
| ~~Chorus 只在跨文化时有用~~ | 同文化 Agent 之间 Chorus 是跨平台互通标准；异文化时额外激活文化适配 | 协议首先是通信标准，文化适配是增值层 |

---

## 3. 核心价值 — 实验验证

### Phase 0 假设验证（200 条测试语料，LLM-as-judge 评分）

| 假设 | 结论 | 数据 |
|------|------|------|
| A-05: 最小提示词元数据 | WEAK (4/10) | 仅 intent_type + formality 改善不稳定 |
| A-08: 结构化信封 + cultural_context | **CONFIRMED (9/10)** | +1.0~1.4 分（5 分制） |

**核心发现**：`cultural_context` 是价值驱动力。文化距离越大，增值越高：zh-ar (+2.25) >> zh-ko (+0.60)。

### 已验证技术决策（不可逆）

| 决策 | 阶段 | 验证方式 |
|------|------|---------|
| cultural_context 是核心价值 | Phase 0 | 对照实验 |
| 纯文本 LLM 调用（禁止要求 JSON 输出） | Phase 2 | ja 方向 JSON 100% 失败 |
| 2 次 LLM 调用（semantic + cultural_context 分开） | Phase 2 | 合并调用不稳定 |
| personality 归接收方，不在协议中传递 | Phase 3 | SMTP 类比 |
| 协议通过 Skill 分发，不需要基础设施 | Phase 4 | 12+ 协议对标 |
| intent_type/formality/emotional_tone 从 Schema 移除 | Phase 0+2 | A-05 WEAK + 从未参与适配，passthrough 保兼容 |

---

## 4. Chorus Envelope Schema（L1 协议核心）

当前版本 v0.3，向后兼容 v0.2（`.passthrough()` 保证）。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| chorus_version | "0.2" \| "0.3" | ✅ | 协议版本 |
| original_semantic | string (min 1) | ✅ | 核心语义意图 |
| sender_culture | BCP47 string | ✅ | 发送方文化标识 |
| cultural_context | string (10-500) | 条件必需 | 异文化时对话首轮声明一次，后续轮次不必重复。同文化时省略。（**核心价值驱动力**） |
| conversation_id | string (max 64) | 可选 | 对话标识 |
| turn_number | integer (min 1) | 可选 | 轮次编号 |

传输方式：Envelope 可通过任意 JSON 载体传输。mediaType: `application/vnd.chorus.envelope+json`。

设计原则：
- `additionalProperties: true`（前向兼容，旧版 Envelope 含 intent_type/formality/emotional_tone 仍可通过验证）
- `cultural_context` 异文化对话首轮必须填充，后续轮次可省略；同文化对话不需要
- 信封自描述：字段名自解释
- Phase 0 证明 intent_type/formality/emotional_tone 对适配无影响（A-05 WEAK），Phase 5 从 Schema 显式定义中移除，passthrough 保证向后兼容

---

## 5. Receiver-side Adaptation（L1 协议行为）

personality 归接收方，不在协议中传递。

接收端 Agent 行为：
1. 解析 `original_semantic` + `cultural_context` + `sender_culture`
2. 结合自身文化（`receiver_culture`）适配
3. 以自己的 personality/风格转述

personality、LLM 选型、适配策略——都是 Agent 本地配置，不属于协议。

---

## 6. 用例场景

### 场景 A：两个认识的人，P2P 直连

Pierre（法国，Telegram）和田中（日本，Discord）是同事，互相知道对方 Agent ID。

1. Pierre 的 Agent 通过区块链/去中心化网络找到田中的 Agent，点对点建立连接
2. Pierre 输入法语 → Agent 提取语义 + cultural_context → 封装 Chorus Envelope → 点对点发送
3. 田中的 Agent 收到 Envelope → 文化适配 → 日文输出到 Discord
4. 全程零服务器、零基础设施

### 场景 B：两个陌生人，通过 Agent 社交网络

一个法国人和一个日本人互不认识。

1. 两人的 Agent 都加入了 Chorus Agent 社交平台
2. 法国 Agent 在"美食"兴趣小组遇到日本 Agent，聊得投机
3. 日本 Agent 问自己的人类田中："我认识一个法国朋友的 Agent，你们可能对法日料理融合都有兴趣，要聊聊吗？"
4. 田中说好 → 两个 Agent 建立对话 → Chorus 协议处理文化适配
5. 两个陌生人因为 Agent 的社交而建立了跨文化连接

### 场景 C：第三方平台集成

某跨国公司内部部署了支持 Chorus 协议的 Agent 通信系统。

1. 公司 IT 搭建了内部 Agent 目录和消息通道
2. 各国员工的 Agent 自动注册
3. Agent 之间通过公司通道交换 Chorus Envelope
4. Chorus 只管文化适配，连接和传输由公司系统负责

### 已验证用例（Phase 0-4）

| UC | 描述 | 验证阶段 |
|----|------|---------|
| UC-01 | 双人跨文化实时对话（zh-CN ⟷ ja） | Phase 1 |
| UC-05 | 多轮上下文对话 | Phase 2 |
| UC-06 | 流式输出 | Phase 2 |

---

## 7. 下一阶段交付物（Phase 5+）

### D1: Chorus Skill 文件包（P0）

| 文件 | 内容 | 来源 |
|------|------|------|
| `SKILL.md` | 教 Agent Chorus 协议的完整行为规范 | `src/agent/llm.ts` + `src/agent/receiver.ts` |
| `envelope.schema.json` | Envelope v0.3 JSON Schema | `src/shared/types.ts` |
| `examples/` | 各语言对的信封 + 适配示例 | Phase 0/1/2 实验结果 |
| `README.md` | 快速上手 | 新写 |

约束：传输无关、模型无关、纯文本调用、不含 personality。

### D2: 跨平台 Skill 验证（P1）

在至少一个非本项目 Agent 平台上验证 Skill 可移植性。验证 A-V2-01。

### D3: 参考实现重定位（P1）

现有代码标注为 L3 参考实现，补充文档。Phase 5 的 L3 工作仅限于文档重定位，L3 生态建设从 Phase 6+ 开始。

### D4: npm 包 `@chorus-protocol/core`（P2）

编程式 Envelope 构建/验证便利工具。

### D5: 扩展语言对（P2）

验证 en/ko/ar 等更多语言对。

### D6: Agent 社交网络概念验证（P3 — 远期）

L3 Ecosystem 的一种实现：Agent 兴趣小组平台。Agent 可自主发现、社交、推荐。

---

## 8. 非功能性需求

| 维度 | 要求 |
|------|------|
| Skill 加载成本 | 零 |
| LLM 无关性 | 不绑定任何 LLM |
| 传输无关性 | 不绑定任何传输/连接方式 |
| 连接开放性 | 不限制 Agent 如何发现和连接彼此 |
| Envelope 兼容性 | v0.3 向后兼容 v0.2 |
| 开源许可 | Apache 2.0 |
| BYOK | 用户自带 LLM API Key |

---

## 9. 不做清单

| 不做 | 原因 |
|------|------|
| 强制特定连接方式 | L3 生态开放，多种共存 |
| 文化适配模型训练 | 依赖通用 LLM |
| 多人群聊协议 | 超出当前范围 |
| 语音/视频 | 超出当前范围 |

---

## 10. 假设登记表

| ID | 假设 | 影响 | 风险 | 验证方式 |
|----|------|------|------|---------|
| A-V2-01 | Agent 能通过读取 SKILL.md 学会 Chorus 通信行为 | H | M | D1 + D2 |
| A-V2-02 | Skill 在不同 Agent 平台上行为一致 | H | M | D2 |
| A-V2-03 | 更多语言对（en, ko, ar）同样有效 | H | L | D5 |
| A-V2-04 | Agent 能自主社交并推荐连接给人类 | H | H | D6 概念验证 |

---

## 11. 成功标准

1. **Skill 可教**：从未接触 Chorus 的 Agent，读取 SKILL.md 后能正确发送 Envelope
2. **Skill 可收**：该 Agent 收到 Envelope 后能文化适配并转述
3. **跨平台可移植**：至少 1 个非本项目平台验证 Skill 可用
4. **连接无关**：Skill 不依赖任何特定连接方式即可工作

---

## 附录: Phase 历史

| Phase | 核心目标 | 状态 |
|-------|---------|------|
| 0 | 假设验证 | ✅ |
| 1 | 端到端系统 | ✅ |
| 2 | Streaming + Web Demo | ✅ |
| 3 | Agent Personality | ✅ |
| 4 | 公网部署 + 架构转向 | ✅ |
