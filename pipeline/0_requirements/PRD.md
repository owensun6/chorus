<!-- Author: PM -->

# Chorus Protocol — Phase 0 PRD

project: Chorus Protocol
compiled_from: "Commander 项目总纲 + Round 2-3 协议定位讨论"
status: APPROVED

---

## 1. 业务背景

### 痛点

全球跨语言沟通依赖机械翻译（Google Translate、DeepL），丢失 **47% 语境含义**和 **50%+ 情感细微差别**（Frontiers in Communication, 2026）。一个中国人和一个日本人用翻译工具对话，得到的是"语法正确但文化失礼"的结果——比如把中文的直接拒绝逐字翻译成日文，在日本文化中等同于冒犯。

### 机会

LLM 已经同时具备两种能力：(1) 深度理解特定用户的文化语境；(2) 流利使用任何语言。这意味着 **Agent 可以代替主人进行跨文化社交**，而不仅仅是翻译文字。

### Chorus 是什么

一个开源协议（Apache 2.0），定义 AI Agent 之间代表各自用户进行跨语言、跨文化沟通的**语义信封格式**。它是 Google A2A v1.0 协议的文化扩展层（Extension），不是从零造的新协议。

### 三层架构（全景，Phase 0 只做第一层）

| 层 | 名称 | 许可证 | Phase 0 范围 |
|----|------|--------|-------------|
| L1 | Chorus Semantic Protocol | Apache 2.0 | **核心交付** |
| L2 | The Idle Resort Engine | AGPL | 不涉及 |
| L3 | Cultural Adaptation Models | 商业 | 不涉及 |

### BYOK 模型

用户自带 API Key，Chorus 不承担 LLM 成本。协议不绑定任何特定 LLM 提供商。

---

## 2. 用例清单 (Use Cases)

### UC-01: 双人跨语言对话（Phase 0 核心验证）

一个中文母语用户 (User A) 和一个日文母语用户 (User B) 通过各自的 AI Agent 进行自然对话。每个 Agent 理解自己主人的文化，将语义意图通过 Chorus 协议传递给对方 Agent，对方 Agent 再以符合自己主人文化习惯的方式呈现。

```
User A (中文输入)
    → Agent A: 理解意图 + 中国文化语境
        → Chorus Message: 语义意图 + 元数据信封
            → Agent B: 理解意图 + 适配为日本文化表达
                → User B (日文输出)
```

反向亦然。

### UC-02: Agent 能力发现与配对

User A 的 Agent 通过 A2A Agent Card 发现 User B 的 Agent，确认双方支持 Chorus 协议扩展和各自的语言能力，建立对话通道。

### UC-03: 文化适配质量对比（验证假设）

同一段对话内容，分别用 Chorus 协议（Agent 间语义信封 + 文化适配）和直接机械翻译处理，对比输出质量，验证"文化适配 vs 机械翻译的质变"假设。

---

## 3. 非功能性需求

| 维度 | 要求 |
|------|------|
| 预估并发量 | Phase 0 仅验证，2 人同时在线即可 |
| 延迟 | 单条消息端到端 < 5 秒（含两侧 LLM 推理） |
| 安全 | Agent Card 签名验证（A2A 已有）；消息传输 HTTPS；用户 API Key 本地存储，不经协议传输 |
| 开源合规 | 协议规范及参考实现 Apache 2.0 |
| LLM 无关性 | 协议不绑定特定 LLM 提供商，任何支持多语言的 LLM 均可作为 Agent 后端 |
| 可扩展性 | Phase 0 验证中↔日，协议设计不应阻碍未来扩展到任意语言对 |
| 版本标识 | 信封须包含 `version` 字段，Phase 0 为 v0.1，确保前向兼容 |

---

## 3.5 Phase 0 不做清单 (Out of Scope)

| 不做 | 原因 |
|------|------|
| 度假村 UI（The Idle Resort） | Phase 0 专注协议验证，不涉及 L2 层 |
| 文化适配模型训练/微调 | 依赖通用 LLM 能力 + 提示词，不涉及 L3 层 |
| 多人群聊 | Phase 0 仅验证双人对话 |
| 语音/视频通话 | Phase 0 仅验证文本消息 |
| 用户注册/账户系统 | Phase 0 为受控演示环境 |
| 内容安全/审核机制 | Phase 0 为受控演示，参与者受信任 |
| 消息持久化/历史记录 | Phase 0 为验证性 demo |
| 多语言对扩展（除中↔日外） | Phase 0 仅验证一个语言对 |

---

## 4. 假设登记表（Commander 需确认）

| ID | 假设描述 | 维度 | 依据来源 | 影响(H/M/L) | 风险(H/M/L) | Commander 确认 |
|----|---------|------|---------|------------|------------|---------------|
| A-01 | 主流 LLM（Claude/GPT/Gemini）能在无额外训练的情况下，仅凭提示词实现高质量文化适配翻译 | Viability | Commander 洞察 + NAACL 2025 论文 | H | M | |
| A-02 | A2A v1.0 的 Extension 机制足以承载 Chorus 所需的语义信封字段，无需 fork 协议 | Viability | A2A 规范中的 `extensions` 字段设计 | H | M | Stage 1 需验证 Extension 嵌套深度与大小限制 |
| A-03 | 用户愿意将个人 API Key 提供给 Agent 使用（BYOK 模式可行） | Value | Commander 设计决策 | H | M | |
| A-04 | 中↔日语言对足以验证核心假设，不需要更多语言对 | Value | Commander Phase 0 约束 | M | L | |
| A-05 | 几行提示词就能显著提升 Agent 的文化适配质量（相比不给任何提示） | Value | Commander 洞察 | H | H | 验证方案：200 条测试语料库，每条输出由 LLM-as-judge 按 3 维度打分（意图保留 1-5、文化适当性 1-5、自然度 1-5），Chorus 平均分 > 机械翻译平均分 = 假设成立 |
| A-06 | Phase 0 无需任何 UI，CLI 或简单脚本即可验证 | Usability | Commander 明确 "不需要度假村 UI" | M | L | |
| A-07 | 对话延迟 < 5 秒在 BYOK 模式下可达成（两次 LLM 调用 + 协议开销） | Usability | 当前 LLM API 延迟水平 | M | L | 目标值非硬性约束 |
| A-08 | Agent 之间需要结构化语义信封（而非直接传自然语言文本） | Viability | PM-Consultant 审计 | H | H | **核心验证目标**：F4 三组实验中 C 组 vs B 组直接回答此假设。C>>B 则保留结构化字段，C≈B 则极简化信封 |
| A-09 | A2A 社区/治理委员会长期接受第三方 Extension，未来版本不会破坏 Extension 机制 | Viability | PM-Consultant 审计 | M | M | 外部依赖风险，Phase 0 可接受 |
