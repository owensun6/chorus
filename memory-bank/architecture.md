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
