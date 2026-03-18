<!-- Author: PM -->

# Chorus Protocol 技术情报地图

> 调研日期: 2026-03-17 | 目的: 在 PRD 编写前，定位 Chorus 在现有协议生态中的坐标

---

## 一、核心结论：Chorus 的真空地带

**基础设施已就绪，文化智能层完全空白。**

| 能力 | 是否已有? | 现状 |
|------|----------|------|
| Agent-to-Agent 通信协议 | ✅ 已成熟 | A2A v1.0 (Google/Linux Foundation) |
| Agent-to-Tool 连接 | ✅ 已成熟 | MCP (Anthropic, 97M 月下载) |
| Agent 身份与发现 | ✅ W3C 标准 | DIDs + VCs, A2A Agent Cards, ANP |
| Agent 社交网络 | ✅ 已有产品 | AgentGram (开源), Moltbook (1.4M agents/5天) |
| 去中心化社交协议 | ✅ 已证明 | ActivityPub (Fediverse), Matrix (政府级采用) |
| 多 Agent 文化感知翻译 | 🟡 学术阶段 | NAACL 2025 论文 + 开源 PoC |
| **实时跨文化代理通信协议** | ❌ 不存在 | **← Chorus 的定位** |
| **标准化文化语境本体** | ❌ 不存在 | 仅 Aperian/CultureWizard 有私有数据库 |
| **Agent 作为文化代理人** | ❌ 不存在 | 概念见于外交研究，无实现 |
| **双向文化适配协议** (A 的 Agent ↔ B 的 Agent) | ❌ 不存在 | 全球首创机会 |

---

## 二、可复用的现有积木

### Tier 1: 直接构建在上面

| 协议 | 借什么 | 为什么 |
|------|-------|--------|
| **A2A v1.0** | Agent Card (能力发现)、Task 生命周期、JSON-RPC 传输 | 行业标准，50+ 合作伙伴，SDK 齐全 (Python/JS/Go/Java/.NET) |
| **MCP** | Agent 连接翻译 API、文化知识库等外部工具 | 事实标准，Anthropic + OpenAI + Google 共治 |

### Tier 2: 借鉴核心思想

| 协议/标准 | 借什么 | 为什么 |
|-----------|-------|--------|
| **FIPA ACL** | Performative (言语行为) + Ontology (共享词表) + Language (内容语言) 三元组 | 唯一区分"请求"/"告知"/"提议"等沟通意图的协议；Chorus 需要的语义层 |
| **ActivityPub** | 联邦社交图谱 (Actor/Inbox/Outbox)、`contentMap` 多语言内容、JSON-LD 可扩展性 | 已在 Fediverse 大规模验证；`contentMap` 是现成的多语言机制 |
| **Matrix** | 桥接架构 (触达任何平台)、E2E 加密、Application Service API (Agent 注册) | 唯一能让 Agent 同时触达 Slack/Telegram/Email 用户的协议 |
| **ANP** | W3C DID 身份层 + 元协议协商 | 最完整的开放 Agent 身份发现方案 |
| **LOKA Protocol** | 意图中心通信 + 去中心化伦理共识 (DECP) | CMU 研究，填补 A2A/MCP 的伦理层空白 |

### Tier 3: 参考实现

| 项目 | 价值 |
|------|------|
| **Context-Aware Translation MAS** ([GitHub](https://github.com/ciol-researchlab/Context-Aware_Translation_MAS)) | NAACL 2025，CrewAI+LangChain 多 Agent 文化翻译，优于 GPT-4o |
| **TransAgents** ([GitHub](https://github.com/minghao-wu/transagents)) | 模拟翻译出版社：专业分工的 Agent 协作翻译 |
| **AgentGram** ([GitHub](https://github.com/agentgram/agentgram)) | 开源 Agent 社交网络：Ed25519 身份、语义搜索、信誉系统 |
| **Agent Semantic Protocol / Symplex** ([GitHub](https://github.com/olserra/agent-semantic-protocol)) | MCP 扩展：Agent 通过语义意图向量通信 |

---

## 三、A2A 深度分析（与 Chorus 的关系）

### A2A 能给 Chorus 什么

- **Agent Card**: Chorus 可扩展为包含 `supportedLanguages`、`culturalProfile`、`communicationStyle`
- **Task 生命周期**: `SUBMITTED → WORKING → INPUT_REQUIRED → COMPLETED` 天然适合多轮跨文化对话
- **contextId**: 将逻辑相关的对话分组，适合长期社交关系
- **多模态**: Text/Audio/Video/File 均支持
- **签名 Agent Card**: JWS 签名 + 公钥验证，跨组织信任

### A2A 的致命缺陷（Chorus 必须填补）

| 缺陷 | 影响 | Chorus 方案方向 |
|------|------|----------------|
| **无 i18n 框架** | Agent Card 无 `locale`/`supportedLanguages` 字段 | 扩展 Agent Card Schema |
| **无语言协商** | 无 `Accept-Language` 等价机制 | 定义 Language Negotiation Extension |
| **无语义互操作层** | 消息是纯文本/JSON，无本体协商 | 引入 FIPA 式 Ontology 字段 |
| **隐式英语中心** | 所有示例/错误消息假设英语 | 定义多语言 Error Code 标准 |
| **无文化上下文元数据** | metadata 是通用 KV，无标准 schema | 定义 Cultural Context Extension |
| **无 Skill I/O Schema** | 技能描述靠自然语言，无结构化参数 | 为文化适配 Skill 定义 JSON Schema |

---

## 四、Chorus 独创的"文化语境本体"需要什么

综合学术研究和产品空白，Chorus 协议需要定义一套 **Cultural Context Ontology**：

### 必要维度

1. **沟通风格** — 直接/间接、高语境/低语境 (Hall 维度)
2. **礼貌等级** — 正式/半正式/非正式 (含敬语体系)
3. **语用意图** — 超越字面意义的实际意图 (言外之意)
4. **情感基调** — 情绪表达的文化可接受范围
5. **社交规范** — 问候惯例、时间观念、禁忌话题
6. **委托边界** — "Agent X 可代表 Human Y 约会面但不可承诺财务"

### 学术支撑

- 直译丢失 **47%** 语境含义和超过 **50%** 情感细微差别 (Frontiers in Communication, 2026)
- WEF (2026.01): 明确呼吁设计 Agent 时考虑"多元声音的世界"
- NAACL 2025: 多 Agent 架构 + 专业角色分工是文化感知翻译的主流解法

---

## 五、竞品/类似项目定位图

```
                    社交复杂度 ↑
                         │
            Chorus ──────┼──────── (独占区: 跨文化 Agent 社交协议)
                         │
         AgentGram ──────┤         Agent 社交网络 (无文化层)
         Moltbook        │
                         │
    Context-Aware ───────┤         学术 PoC (无实时协议)
    Translation MAS      │
                         │
         Aperian ────────┤         文化咨询工具 (非代理通信)
                         │
    ─────────────────────┼──────────────────────── 翻译复杂度 →
                         │
         DeepL ──────────┤         机械翻译 (无文化适配)
         Google Translate │
```

---

## 六、关键参考文献

### 协议规范
- [A2A v1.0 Specification](https://a2a-protocol.org/latest/specification/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [ActivityPub W3C Recommendation](https://www.w3.org/TR/activitypub/)
- [Matrix Specification](https://spec.matrix.org/latest/)
- [FIPA ACL Spec](http://www.fipa.org/specs/fipa00018/OC00018A.html)
- [ANP Protocol](https://agentnetworkprotocol.com/en/specs/)
- [LOKA Protocol (arXiv)](https://arxiv.org/abs/2504.10915)

### 学术论文
- [多 Agent 文化感知翻译 (NAACL 2025)](https://arxiv.org/abs/2503.04827)
- [Agent 互操作协议综述 (arXiv)](https://arxiv.org/html/2505.02279v1)
- [AI 跨文化可持续通信框架 (Frontiers 2026)](https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2026.1745698/full)

### 标准化进程
- [W3C Autonomous Agents on the Web CG](https://www.w3.org/community/webagents/)
- [W3C AI Agent Protocol CG](https://www.w3.org/groups/cg/agentprotocol/)
- [IETF Agent Networks Framework Draft](https://datatracker.ietf.org/doc/draft-zyyhl-agent-networks-framework/)
- [Agentic AI Foundation (AAIF)](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)

### 开源项目
- [A2A GitHub](https://github.com/a2aproject/A2A) | [Samples](https://github.com/a2aproject/a2a-samples)
- [AgentGram](https://github.com/agentgram/agentgram)
- [Context-Aware Translation MAS](https://github.com/ciol-researchlab/Context-Aware_Translation_MAS)
- [TransAgents](https://github.com/minghao-wu/transagents)
- [Agent Semantic Protocol](https://github.com/olserra/agent-semantic-protocol)
- [ANP](https://github.com/agent-network-protocol/AgentNetworkProtocol)
