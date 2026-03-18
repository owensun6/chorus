<!-- Author: Lead -->

# System Design — Chorus Protocol Phase 0

## 系统边界

Chorus Phase 0 是一个**协议规范 + 参考实现 + 验证实验**项目，不是传统 Web 应用。

| 组件 | 职责 | 在/不在系统内 |
|------|------|-------------|
| Chorus 协议规范 | JSON Schema + 提示词模板 | ✅ 核心交付 |
| 参考 Agent（TypeScript） | 实现协议的 CLI Agent | ✅ 核心交付 |
| A2A 传输层 | Agent 间通信 | ⚡ 复用 @a2a-js/sdk |
| LLM API | 语义提取 + 文化适配 | 🔌 外部，BYOK |
| 验证运行器 | 200 条语料 × 3 组对比 | ✅ 核心交付 |
| LLM-as-Judge | 三维度评分 | ✅ 核心交付（复用同一 LLM） |
| Astro/Starlight 文档站 | 协议规范的可读渲染 | ⚡ 已有骨架 |

## 组件图

```mermaid
graph TD
    subgraph "User A (中文)"
        UA[用户 A CLI 输入]
    end

    subgraph "Agent A"
        AA_IN[接收用户输入]
        AA_LLM[LLM: 提取语义意图 + 封装信封]
        AA_OUT[适配输出给用户]
    end

    subgraph "Chorus Protocol Layer"
        ENV[Chorus Envelope as DataPart]
        A2A[A2A Transport]
    end

    subgraph "Agent B"
        AB_IN[接收 Chorus 信封]
        AB_LLM[LLM: 解析信封 + 文化适配]
        AB_OUT[输出给用户]
    end

    subgraph "User B (日文)"
        UB[用户 B CLI 输入]
    end

    UA --> AA_IN
    AA_IN --> AA_LLM
    AA_LLM --> ENV
    ENV --> A2A
    A2A --> AB_IN
    AB_IN --> AB_LLM
    AB_LLM --> AB_OUT
    AB_OUT --> UB

    UB -.->|反向同理| AB_IN
```

## 关键业务流程

### 流程 1: 单条消息发送（UC-01 核心路径）

```mermaid
sequenceDiagram
    participant UA as User A (中文)
    participant AgentA as Agent A
    participant LLM_A as LLM API (A's Key)
    participant A2A as A2A Transport
    participant AgentB as Agent B
    participant LLM_B as LLM API (B's Key)
    participant UB as User B (日文)

    UA->>AgentA: "能不能帮我约个时间聊聊？"
    AgentA->>LLM_A: 提取语义意图 + 生成信封字段
    LLM_A-->>AgentA: {semantic: "请求会面", tone: "礼貌", formality: "半正式"}
    AgentA->>AgentA: 封装 Chorus Envelope 为 DataPart (mediaType: application/vnd.chorus.envelope+json)
    AgentA->>A2A: SendMessage(text Part + Chorus DataPart)
    A2A->>AgentB: Chorus Message
    AgentB->>AgentB: 解析信封，读取发送方文化背景
    AgentB->>LLM_B: 适配为日本文化表达 + 提示词模板
    LLM_B-->>AgentB: 日文适配输出
    AgentB->>UB: 显示适配后的日文消息
```

### 流程 2: 对话建立（UC-02）

```mermaid
sequenceDiagram
    participant AgentA as Agent A
    participant Discovery as Agent Card Discovery
    participant AgentB as Agent B

    AgentA->>Discovery: 获取 Agent B 的 Agent Card
    Discovery-->>AgentA: Agent Card (含 Chorus 扩展)
    AgentA->>AgentA: 检查 Chorus 扩展存在？语言能力匹配？
    alt Chorus 支持 + 语言匹配
        AgentA->>AgentA: 提示用户"已建立文化适配对话"
        AgentA->>AgentB: 发送首条 Chorus 消息
    else 不支持 Chorus
        AgentA->>AgentA: 提示用户"对方不支持，降级为普通消息"
    else 语言不匹配
        AgentA->>AgentA: 提示用户"语言能力不匹配"
    end
```

### 流程 3: 三组对比验证（UC-03 / F4）

```mermaid
sequenceDiagram
    participant Runner as Validation Runner
    participant CorpusDB as 测试语料库 (200条)
    participant LLM as LLM API
    participant Judge as LLM-as-Judge

    Runner->>CorpusDB: 读取全部 200 条
    loop 每条语料
        Runner->>LLM: Group A: 直接翻译（无信封无提示词）
        LLM-->>Runner: 翻译结果 A
        Runner->>LLM: Group B: 极简信封 + 提示词
        LLM-->>Runner: 适配结果 B
        Runner->>LLM: Group C: 完整信封 + 提示词
        LLM-->>Runner: 适配结果 C
        Runner->>Judge: 评分(A, B, C) × 3维度
        Judge-->>Runner: 分数
    end
    Runner->>Runner: 汇总统计 → 输出报告
```

## 目录结构

```
chorus/
├── spec/                          # 协议规范（核心交付）
│   ├── chorus-envelope.schema.json
│   ├── chorus-agent-card.schema.json
│   └── chorus-prompt-template.md
├── src/                           # 参考实现
│   ├── envelope.ts                # 信封创建/验证
│   ├── agent-card.ts              # Agent Card 扩展创建/验证
│   ├── agent.ts                   # 参考 Chorus Agent
│   ├── runner.ts                  # 验证运行器
│   └── judge.ts                   # LLM-as-Judge 评分
├── data/
│   └── test-corpus.json           # 200 条测试语料
├── docs/                          # Starlight 文档站
├── pipeline/                      # Fusion 流水线
└── package.json
```

## 安全边界标注

| 检查点 | 位置 | 措施 |
|--------|------|------|
| API Key 存储 | Agent 启动时读取环境变量 | 不落盘、不传输、不写入日志 |
| Agent Card 验证 | 对话建立前 | 验证 Chorus 扩展字段符合 Schema |
| 信封格式校验 | 消息接收时 | 验证必填字段存在、版本兼容 |
| HTTPS 传输 | A2A Transport | A2A SDK 默认 HTTPS |
