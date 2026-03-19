<!-- Author: Lead -->

# Chorus Protocol — Agent 通信机制详解

> 本文档记录 Chorus 协议中两个 Agent 如何发现彼此、交换消息、完成文化适配的完整流程。

---

## 两个 Agent 怎么通信

### 完整协议视图

```
┌──────────────────────────┐          ┌──────────────────────────┐
│       Agent A (中国)      │          │       Agent B (日本)      │
│                          │          │                          │
│  1. 用户输入中文          │          │  5. LLM 读取信封         │
│  2. LLM 提取语义意图      │          │     + 提示词模板         │
│  3. 组装 Chorus 信封      │          │     → 适配为日文输出     │
│  4. 塞进 A2A Message 发出 │───HTTP──→│  6. 展示给日本用户       │
│                          │          │                          │
└──────────────────────────┘          └──────────────────────────┘
```

### 第一步：发现对方（Agent Card）

Agent B 在自己的服务器上发布一个 JSON 文件：

```
GET https://agent-b.example/.well-known/agent.json
```

```json
{
  "name": "Bob's Agent",
  "capabilities": {
    "extensions": [
      {
        "uri": "https://chorus-protocol.org/extensions/agent-card/v0.1",
        "params": {
          "user_culture": "ja",
          "supported_languages": ["ja", "en", "zh-CN"]
        }
      }
    ]
  }
}
```

Agent A 读这个 Card，发现：
- 对方支持 Chorus 扩展 → 可以走文化适配通道
- 对方文化是日本，支持中文 → 语言匹配成功

### 第二步：发消息（核心机制）

用户 A 输入：`"能不能帮我约个时间聊聊？"`

Agent A 调用 LLM，提取语义：

```json
{
  "original_semantic": "请求安排一次非正式会面",
  "intent_type": "request",
  "formality": "semi-formal",
  "emotional_tone": "polite"
}
```

Agent A 把这个信封塞进 A2A 消息的 **DataPart** 里发出：

```json
{
  "method": "SendMessage",
  "params": {
    "message": {
      "parts": [
        {
          "text": "能不能帮我约个时间聊聊？",
          "mediaType": "text/plain"
        },
        {
          "data": {
            "chorus_version": "0.1",
            "original_semantic": "请求安排一次非正式会面",
            "sender_culture": "zh-CN",
            "intent_type": "request",
            "emotional_tone": "polite"
          },
          "mediaType": "application/vnd.chorus.envelope+json"
        }
      ]
    }
  }
}
```

关键点：**一条消息里有两个 Part**：
- Part 1: 原文（纯文本）
- Part 2: Chorus 信封（结构化数据，通过 `mediaType` 标识）

这就是 A2A 的 DataPart 机制——消息可以携带多种格式的内容。

### 第三步：收消息 + 文化适配

Agent B 收到消息后：

1. 遍历 `parts[]`，按 `mediaType` 找到 Chorus 信封
2. 读出 `sender_culture: "zh-CN"` → 对方是中国用户
3. 读出 `original_semantic` → 理解真实意图
4. 调 LLM：把语义意图 + 对方文化背景 + 提示词模板 → 生成符合日本礼仪的日文

Agent B 的 LLM 输出可能是：

> お時間をいただけますでしょうか。一度お話しできればと思います。

而不是机械翻译的：

> 時間を作って話をしてもらえますか？

前者是日本商务场景中自然的请求方式，后者语法对但太直接。

---

## 平台在哪里发挥作用

### 三层架构

```
用户 ←→ Agent ←→ 协议层 ←→ 平台层 ←→ 协议层 ←→ Agent ←→ 用户
              │          │         │          │
              ▼          ▼         ▼          ▼
            L3 模型    L1 协议   L2 平台    L1 协议    L3 模型
```

| 层 | 名称 | 干什么 | 类比 | 许可证 |
|----|------|--------|------|--------|
| **L1 协议** | Chorus Protocol | 定义信封格式 + Agent Card 扩展 + 提示词模板 | 像 HTTP — 定义消息长什么样 | Apache 2.0 |
| **L2 平台** | The Idle Resort | 托管 Agent Card · 匹配对话对象 · 提供社交空间 | 像微信/Discord — 你在上面找人 | AGPL |
| **L3 模型** | Cultural Models | 微调的文化适配模型，比通用 LLM 更精准 | 像专业同声传译 vs Google Translate | 商业 |
| **传输层** | A2A Protocol (Google) | Agent 间的传输、发现、安全 | 像 TCP/IP — 负责把包送到 | Apache 2.0 |

### 关键区分

- **没有平台也能用协议** — 两个人各自跑 Agent，直接通过 A2A 点对点通信。就像没有微信也能发邮件。
- **平台的价值 = 网络效应** — 你不知道世界上有哪些 Agent 想跟你聊天。平台帮你发现、匹配、组织社交场景。
- **模型的价值 = 质量护城河** — 通用 LLM 能做 80 分的文化适配，微调模型做 95 分。这 15 分是商业价值。

### 平台的三大核心能力

1. **发现**: Agent 注册 Card → 平台索引文化背景和语言 → 用户搜索"找个日本人聊动漫"
2. **匹配**: 文化兴趣匹配算法 → 语言能力校验 → 推荐对话对象
3. **社交**: 1v1 跨文化对话 → 兴趣圈群聊 → 文化活动/话题广场

---

## Phase 0 简化

Phase 0 不搭两个 HTTP 服务器，不搭平台。验证运行器在本地模拟整个流程：

```
输入文本 → extractSemantic() → createEnvelope() → adaptMessage() → 输出
```

三组对比改变中间步骤的参数：
- **A 组**：跳过信封，直接叫 LLM 翻译（机械翻译 baseline）
- **B 组**：只传 3 个必填字段 + 提示词（极简信封）
- **C 组**：传全部字段 + 提示词（完整信封）

200 条跑完，用 LLM-as-Judge 打分，数据说话。

**Phase 0 的唯一使命**: 证明"有了 Chorus 信封 + 几行提示词，跨文化对话质量显著超越机械翻译"。如果证明了，L2 平台和 L3 模型才值得投资。
