# Chorus Protocol — Architecture Decisions

## Phase 0 核心发现

- **A-08 CONFIRMED (9/10)**: 结构化信封 + `cultural_context` 显著提升跨文化沟通质量（+1.0~1.4 分，5 分制）
- **A-05 WEAK (4/10)**: 仅 intent_type + formality 改善不稳定
- **关键洞察**: `cultural_context`（自然语言文化背景说明）是核心价值驱动力，但 Phase 0 Schema 中未定义
- **文化距离效应**: 文化距离越大，协议增值越高。zh-ar (+2.25) >> zh-ko (+0.60)

## Phase 1 架构方向（Stage 1 待产出）

### 三大交付物
1. **D1: Chorus Protocol Spec v0.2** — Schema 新增 `cultural_context` 字段
2. **D2: Chorus Routing Server** — Agent 注册 + 发现 + 消息转发（纯透传，不解析信封）
3. **D3: Reference Agent Pair** — zh-CN + ja CLI Agent

### 关键设计决策
- Chorus = 纯协议路由层，不带 AI 算力
- `cultural_context` 协议只定义字段格式，生成由 Agent 实现者决定（推荐 LLM 自动生成）
- v0.2 Schema: `additionalProperties: true` 确保前向兼容
- 路由服务器：内存存储，无持久化，无鉴权，无心跳（localhost demo）
- A-P1-04 (H×H): A2A SDK DataPart 可行性需 spike 验证，fallback = raw HTTP

### 信封传输机制
- Chorus Envelope 作为 A2A Message 的 DataPart 传输
- mediaType: `application/vnd.chorus.envelope+json`
- 路由服务器纯透传，不解析 DataPart 内容

## Phase 2 架构演进

### 新增组件
- **Streaming**: HTTP chunked response 逐层透传（Agent→Router→Client）
- **Web Demo**: 单页 HTML + SSE 实时事件流 + POST /api/send
- **Demo 编排器**: 单进程启动 Router + 2 Agents + Web Server
- **ConversationHistory**: Agent 内存 Map，FIFO 截断，最大 10 轮

### 信封 v0.3
- chorus_version 接受 "0.2" | "0.3"
- 新增可选: conversation_id (string max64), turn_number (integer min1)
- 向后兼容 v0.2（additionalProperties: true）

### LLM 架构（重大简化）
- **原方案**: 1 次 JSON 调用 → parse → enum 校验（脆弱，ja 方向 100% 失败）
- **新方案**: 2 次纯文本调用（semantic + cultural_context），零格式失败
- intent_type/formality/emotional_tone 已删除（从未参与适配）
- 非流式函数是流式函数的 thin wrapper（消除代码重复）

### Agent 人格模式
- 从"只输出适配文本"→"用自己的方式转告用户"
- Agent 作为文化朋友传话，而非隐形翻译管道
- 不定义人格参数——LLM 自带人格

### LLM 配置
- 端点: coding.dashscope.aliyuncs.com/v1
- 模型: qwen3-coder-next（1.4s/调用，零 thinking overhead）
- 横评结论: qwen3-coder-next > kimi-k2.5 > qwen3-coder-plus > 其余
