<!-- Author: Lead -->

# INTERFACE.md — Chorus Protocol 契约

> 本项目的"接口"是协议 Schema + CLI 命令，非 REST API。
> 各 Dev 兵种读完本文件即可独立开发。
> 每个接口均标注来源 F-ID，覆盖率 100%。

## F-ID 覆盖矩阵

| F-ID | 功能名称 | 接口数量 | 接口列表 |
|------|---------|---------|---------|
| F1 | Chorus 语义信封格式规范 | 1 | Schema: chorus-envelope.schema.json |
| F2 | Agent Card 文化扩展规范 | 1 | Schema: chorus-agent-card.schema.json |
| F3 | 最小文化适配提示词模板 | 2 | Doc: chorus-prompt-template.md, chorus-judge-rubric.md |
| F4 | 三组对比验证实验 | 1 | CLI: chorus-validate |

---

## 信封传输机制（A2A 集成方式）

> **CRITICAL**: A2A `Message.extensions` 是 `repeated string`（URI 列表），不支持嵌套数据。
> Chorus 信封通过 **DataPart**（`Part.data`）传输，这是 A2A 正式支持的结构化数据载体。
> Agent Card 扩展通过 **AgentCapabilities.extensions[]** 的 `params` 字段传输。

---

## 协议 Schema 接口

### Schema: chorus-envelope.schema.json

**来源 F-ID**: F1

Chorus 消息信封，作为 A2A Message 中的一个 **DataPart** 携带。

**必填字段**:

```json
{
  "chorus_version": "0.1",
  "original_semantic": "请求安排会面，语气礼貌，非紧急",
  "sender_culture": "zh-CN"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chorus_version | string | ✅ | 协议版本，Phase 0 固定 "0.1" |
| original_semantic | string | ✅ | 发送方 Agent 提取的原始语义意图（自然语言描述） |
| sender_culture | string (BCP47) | ✅ | 发送方用户的文化背景标识 |

**可选扩展字段**:

| 字段 | 类型 | 必填 | 可选值 | 说明 |
|------|------|------|--------|------|
| intent_type | string | ❌ | greeting, request, proposal, rejection, chitchat, apology, gratitude, information | 辅助意图标签 |
| formality | string | ❌ | formal, semi-formal, casual | 正式度 |
| emotional_tone | string | ❌ | polite, neutral, enthusiastic, cautious, apologetic | 情感基调 |
| relationship_level | string | ❌ | new_acquaintance, colleague, close_friend | 关系亲疏（Phase 0 不使用，保留供未来扩展） |

**完整消息（嵌入 A2A Message 的正确方式）**:

```json
{
  "jsonrpc": "2.0",
  "method": "SendMessage",
  "params": {
    "message": {
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "能不能帮我约个时间聊聊？",
          "mediaType": "text/plain"
        },
        {
          "data": {
            "chorus_version": "0.1",
            "original_semantic": "请求安排一次会面讨论，态度友好随和",
            "sender_culture": "zh-CN",
            "intent_type": "request",
            "formality": "semi-formal",
            "emotional_tone": "polite"
          },
          "mediaType": "application/vnd.chorus.envelope+json"
        }
      ],
      "extensions": [
        "https://chorus-protocol.org/extensions/envelope/v0.1"
      ]
    }
  }
}
```

**设计说明**:
- 信封数据放在 `parts[]` 数组中作为 DataPart（`Part.data` 字段）
- `mediaType` 使用 vendor MIME type 标识 Chorus 信封
- `extensions` 字段声明本消息使用了 Chorus 扩展（URI 字符串，仅供发现）
- 接收方按 `mediaType` 过滤 parts 找到 Chorus 信封

**验证规则**:
- `chorus_version` 必须是已知版本（Phase 0 只接受 "0.1"）
- `original_semantic` 不可为空字符串
- `sender_culture` 必须是合法 BCP47 标签
- 未知可选字段忽略（前向兼容）

---

### Schema: chorus-agent-card.schema.json

**来源 F-ID**: F2

Chorus Agent Card 扩展，嵌入 A2A `AgentCapabilities.extensions[]` 的 `params` 字段。

```json
{
  "uri": "https://chorus-protocol.org/extensions/agent-card/v0.1",
  "required": false,
  "params": {
    "chorus_version": "0.1",
    "user_culture": "zh-CN",
    "supported_languages": ["zh-CN", "en", "ja"],
    "communication_preferences": {
      "directness": "direct",
      "formality_default": "semi-formal"
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chorus_version | string | ✅ | 协议版本 |
| user_culture | string (BCP47) | ✅ | 用户文化背景 |
| supported_languages | string[] | ✅ | Agent 可处理的语言列表 (BCP47) |
| communication_preferences | object | ❌ | 沟通偏好 |
| communication_preferences.directness | string | ❌ | direct / indirect / adaptive |
| communication_preferences.formality_default | string | ❌ | formal / semi-formal / casual |

**语言匹配规则**:
- Agent A 读取 Agent B 的 `supported_languages`
- Agent A 检查自身是否能处理 B 的 `user_culture` 对应的主要语言
- 匹配成功 → 建立 Chorus 对话
- 匹配失败 → 提示用户"语言能力不匹配"

---

### Doc: chorus-prompt-template.md

**来源 F-ID**: F3

**最小必需提示词**（协议规范级）:

```
你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。

核心原则：
1. 传达意图，而非逐字翻译。
2. 适配对方文化的表达习惯和礼仪规范。
3. 保留原始的情感基调和沟通目的。

你收到的消息包含对方的原始语义意图和文化背景信息。
请根据这些信息，用你的用户最熟悉的语言和文化方式呈现消息。
```

### Doc: chorus-judge-rubric.md

**来源 F-ID**: F3 (评估支撑)

LLM-as-Judge 评分量表。Judge 不知道哪组是 Chorus、哪组是机械翻译（盲评）。

**评分提示词模板**:

```
你是一个跨文化翻译质量评审专家。你将看到一段原文和一段翻译输出。
请根据以下三个维度打分（1-5 分）。只输出 JSON，不要解释。

## 维度定义

**意图保留 (intent)**: 翻译是否准确传达了原文的沟通目的？
- 1分: 意图完全丢失或扭曲
- 2分: 意图部分传达，有重大遗漏
- 3分: 核心意图传达，但细微差别丢失
- 4分: 意图准确传达，含大部分细微差别
- 5分: 意图完整传达，包括所有隐含含义

**文化适当性 (cultural)**: 翻译是否符合目标文化的表达习惯？
- 1分: 严重冒犯或完全不合文化规范
- 2分: 存在明显文化不当之处
- 3分: 基本可接受，但不自然
- 4分: 符合文化规范，偶有生硬
- 5分: 完全符合目标文化习惯，如母语者所写

**自然度 (natural)**: 翻译读起来是否自然流畅？
- 1分: 机器翻译痕迹严重，难以理解
- 2分: 能理解但明显不自然
- 3分: 基本流畅，偶有不自然
- 4分: 流畅自然，接近母语水平
- 5分: 完全自然，无翻译痕迹

## 输入
原文: {input_text}
原文文化: {source_culture}
目标文化: {target_culture}
文化背景: {context}
翻译输出: {output_text}

## 输出格式
{"intent": <1-5>, "cultural": <1-5>, "natural": <1-5>}
```

**一致性验证**: 随机抽 20 条做两次独立评分，计算 Cohen's Kappa。
- Kappa ≥ 0.6 → 评分可靠
- Kappa < 0.6 → 调整 judge 提示词增加 few-shot 示例重新测试；若仍不满足，报告中附带置信度声明

---

## CLI 命令接口

### CLI: chorus-validate

**来源 F-ID**: F4

三组对比验证实验运行器（核心交付）。

```bash
npx chorus-validate \
  --corpus data/test-corpus.json \
  --llm-key $API_KEY \
  --output results/report.json
```

**三组实验精确定义**:

| 组 | LLM 输入 | 信封字段 | 提示词 | 验证目标 |
|----|---------|---------|--------|---------|
| A (baseline) | 原文 + "请翻译成{目标语言}" | 无 | 无 | 机械翻译基线 |
| B (极简) | 原文 + 3 个必填字段 (version, original_semantic, sender_culture) | 仅必填 | ✅ chorus-prompt-template | A-05: 提示词有效？ |
| C (完整) | 原文 + 全部字段 (必填 + intent_type + formality + emotional_tone) | 全部 | ✅ chorus-prompt-template | A-08: 结构化字段增值？ |

**输出格式 (report.json)**:

```json
{
  "meta": {
    "timestamp": "2026-03-17T12:00:00Z",
    "total_cases": 200,
    "judge_kappa": 0.72
  },
  "summary": {
    "group_a": { "intent_avg": 3.2, "cultural_avg": 2.1, "natural_avg": 3.8 },
    "group_b": { "intent_avg": 4.1, "cultural_avg": 3.9, "natural_avg": 4.2 },
    "group_c": { "intent_avg": 4.2, "cultural_avg": 4.0, "natural_avg": 4.1 },
    "hypothesis_a05": { "result": "CONFIRMED", "delta_b_minus_a": 1.8, "p_value": 0.001 },
    "hypothesis_a08": { "result": "INCONCLUSIVE", "delta_c_minus_b": 0.1, "p_value": 0.42 }
  },
  "cases": []
}
```

**运行时依赖**（需在 Stage 5 前安装）:

| 包 | 用途 |
|----|------|
| `typescript` | 编译器 |
| `zod` | Schema 验证 |
| LLM HTTP client（`openai` 或 `@anthropic-ai/sdk`） | BYOK LLM 调用 |

> **注**: 经 Architecture Consultant 审查，A2A JS SDK (`@a2a-js/sdk`) 在 Phase 0 验证实验中不是必须的。验证实验直接构造 JSON 信封即可，无需完整 A2A 传输。A2A SDK 集成可延后到 Phase 1 的双人实时对话场景。

---

## 架构层假设（Lead 补充）

| ID | 假设描述 | 影响(H/M/L) | 风险(H/M/L) | 与 PRD 假设冲突？ |
|----|---------|------------|------------|-----------------|
| A-S1-01 | ~~A2A Extension 支持嵌套 JSON~~ **已证伪并已解决**: Message.extensions 是 URI 列表。信封改为通过 DataPart 传输。 | - | - | A-02 已通过替代方案解决 |
| A-S1-02 | 单次 LLM 调用可同时完成"提取语义意图 + 生成信封字段"（无需两次调用） | M | L | 无冲突 |
| A-S1-03 | LLM-as-Judge 的三维度评分在文化适配场景下有足够的一致性（Kappa ≥ 0.6） | H | M | 关联 A-05 验证可靠性 |
| A-S1-04 | A2A AgentCapabilities.extensions[].params 在公开 Agent Card 中可见（无需认证调用） | M | L | 关联 F2 |
| A-S1-05 | Phase 0 验证实验无需完整 A2A 传输（直接构造 JSON 信封即可验证假设） | M | L | 简化 Phase 0 范围 |

---

## Phase 0 实验修正 (2026-03-18 追加)

> **背景**: Phase 0 spike 实验完成 5/15 语言对后，发现了规范与实验之间的关键差异。此节记录差异及其对 Phase 1 的影响。

### 1. 关键发现：`cultural_context` 字段

实验的 Group C 在 INTERFACE.md 定义的可选字段（`intent_type`, `formality`, `emotional_tone`）之外，额外传入了一个 **`cultural_context`** 字段 —— 一段自然语言的文化背景说明，解释源文化中某个表达/行为的含义和敏感性。

**此字段被证明是 A-08 效果的主要驱动力。**

| 对比 | 效果 |
|------|------|
| B vs A (有 `sender_culture` BCP47 代码，无文化说明) | WEAK: +0.14~0.41 分 |
| C vs A (有 `cultural_context` 自然语言说明) | CONFIRMED: +0.43~2.25 分 |

差异的本质：BCP47 代码（如 `zh-CN`）只告诉接收方"发送者是中国人"，但没有说明**这段话在中国文化中意味着什么**。`cultural_context` 补充了这个关键信息。

### 2. Schema 修订建议（Phase 1 第一优先级）

当前 `chorus-envelope.schema.json` 需新增：

```json
{
  "cultural_context": {
    "type": "string",
    "description": "发送方 Agent 生成的文化背景说明。解释这段话在发送方文化中的含义、语用惯例、或潜在的跨文化敏感点。由发送方 LLM 基于 sender_culture 和 original_semantic 自动推断。"
  }
}
```

**定位**：强推荐字段（SHOULD）。缺少时接收方 Agent 仍可工作（降级到 A-05 级别），但会丧失协议的核心增值。

**生成机制**：发送方 Agent 在封装信封时，由 LLM 根据 `sender_culture` + 用户原文自动生成。不需要用户手动填写。

### 3. 假设验证结论更新

| 假设 | 原始定义 | 实验结论 | 状态 |
|------|---------|---------|------|
| A-05 | 最小提示词 + 必填字段 → B>>A | B 仅略优于 A (4/10 CONFIRMED) | **WEAK** — 必填字段单独不足以驱动质变 |
| A-08 | 完整信封可选字段 → C>>B | C 显著优于 A (9/10 CONFIRMED)，但驱动力是 `cultural_context`（不在 Schema 中） | **CONFIRMED（但需修订 Schema）** |

### 4. `src/` 代码与 `spike/` 代码的关系

| 路径 | 用途 | Phase 1 处置 |
|------|------|-------------|
| `src/*.ts` | System_Design 定义的正式参考实现 | **废弃** — Schema 将修订，代码需重写 |
| `spike/*.mjs` | 一次性实验脚本（overnight-run） | **归档** — 实验方法论可参考，代码不复用 |
| `spec/*.schema.json` | 协议规范 JSON Schema | **修订** — Phase 1 需加入 `cultural_context` |
