# Chorus — Architecture Decisions

> 权威需求文档: `pipeline/PRD.md`（统一 PRD v2.0）。本文件记录架构实现决策。

---

## Chorus 三层平台架构

| 层 | 名称 | 职责 |
|----|------|------|
| L1 | **Chorus Protocol** | 协议规范 — 信封格式 + 通信行为定义 (`skill/PROTOCOL.md` v0.4, 71 行) |
| L2 | **Chorus Skill** | 协议分发 — 教 Agent 学会用 Chorus (`skill/SKILL.md`, 75 行) |
| L3 | **Chorus Ecosystem** | 连接生态 — `skill/TRANSPORT.md`(默认 HTTP profile) + `src/`(参考实现) + 任意第三方 |

### L3 连接模式（开放，不限制）

| 模式 | 描述 |
|------|------|
| P2P 直连 | 互相知道 Agent ID，通过区块链等去中心化方式点对点连接 |
| Agent 社交网络 | Chorus Agent 兴趣小组平台，Agent 自主社交、推荐连接 |
| 第三方集成 | 任何第三方用 Chorus 协议建立自己的连接方式 |
| 宿主平台内置 | A2A / MCP / 任意平台自带的 agent-to-agent 通信 |

### Chorus 的边界

```
✅ Chorus 管：信封格式 + Agent 间通信行为（L1 协议 + L2 Skill）
✅ Chorus 可选管：Agent 连接基础设施（L3 — Chorus Server / P2P 直连）
❌ Chorus 不管：Agent↔Human 对接（已由 OpenClaw channels 等解决）
❌ Chorus 不管：强制特定传输/发现/认证方式

### Phase 5 协议升维（2026-03-19）

- Chorus = Link（一个动词）。首先是跨平台 Agent 通信标准，文化适配是增值层
- original_semantic 删除 → original_text。Agent IS the LLM，不需要"语义提取"步骤
- sender_id 格式 name@host（类 email 地址），host 命名空间保证唯一性
- Envelope v0.4：7 字段（chorus_version, sender_id, original_text, sender_culture, cultural_context, conversation_id, turn_number）
- Response 格式 + 3 错误码：INVALID_ENVELOPE, UNSUPPORTED_VERSION, ADAPTATION_FAILED
- Skill 分发：npm CLI `npx @chorus-protocol/skill init --lang en|zh-CN`
```

### Phase 5 整改 — L3 Transport Profile（2026-03-20）

- 新增 `skill/TRANSPORT.md`（298 行）— 可选 L3 默认传输方案，不是核心协议扩张
- 调研 SMTP/XMPP/Matrix/A2A/ActivityPub 后设计：抽象操作 + HTTP 绑定
- 4 个抽象操作：Register / Unregister / Discover / Send
- HTTP 绑定：POST /agents, DELETE /agents/:id, GET /agents, POST /messages
- Send 操作用裸 envelope（MUST），A2A 包装为 MAY（alternate encoding）
- sender_id 单一来源：只在 envelope 中，transport 不重复（避免 SMTP FROM/From 不一致问题）
- receiver_id canonical form = name@host，本地短名 SHOULD accept
- 投递状态：delivered / failed / rejected + 重试规则
- 发现机制：`/.well-known/chorus.json`（SHOULD）
- SSE streaming：MAY 扩展，明确是接收方内容流透传
- envelope.schema.json：chorus_version enum 从 ["0.2","0.3","0.4"] → ["0.4"]
- SKILL.md 重写：7 个问题修复 + 集成 TRANSPORT.md 连接指导

---

## Phase 0 核心发现

- **A-08 CONFIRMED (9/10)**: 结构化信封 + `cultural_context` 显著提升跨文化沟通质量（+1.0~1.4 分，5 分制）
- **A-05 WEAK (4/10)**: 仅 intent_type + formality 改善不稳定
- **关键洞察**: `cultural_context` 是核心价值驱动力
- **文化距离效应**: 文化距离越大，协议增值越高。zh-ar (+2.25) >> zh-ko (+0.60)

---

## Phase 1 架构决策

### 交付物
1. **Chorus Protocol Spec v0.2** — Schema 新增 `cultural_context` 字段
2. **Chorus Routing Server** — Agent 注册 + 发现 + 消息转发（纯透传）— 现归类为 L3 参考实现
3. **Reference Agent Pair** — zh-CN + ja CLI Agent — 现归类为 L3 参考实现

### 关键决策
- `cultural_context` 协议只定义字段格式，生成由 Agent 实现者决定（推荐 LLM 自动生成）
- v0.2 Schema: `additionalProperties: true` 确保前向兼容

### 信封传输
- Envelope 可通过任意 JSON 载体传输
- mediaType: `application/vnd.chorus.envelope+json`
- 参考实现中作为 A2A Message 的 DataPart 传输

---

## Phase 2 架构演进

### 新增组件（均归类为 L3 参考实现）
- **Streaming**: HTTP chunked response 逐层透传
- **Web Demo**: 单页 HTML + SSE 实时事件流
- **Demo 编排器**: 单进程启动 Router + 2 Agents + Web Server
- **ConversationHistory**: Agent 内存 Map，FIFO 截断，最大 10 轮

### 信封 v0.3
- chorus_version 接受 "0.2" | "0.3"
- 新增可选: conversation_id (string max64), turn_number (integer min1)
- 向后兼容 v0.2（additionalProperties: true）

### LLM 架构（重大简化）
- **原方案**: 1 次 JSON 调用 → parse → enum 校验（脆弱，ja 方向 100% 失败）
- **新方案**: 2 次纯文本调用（semantic + cultural_context），零格式失败
- intent_type/formality/emotional_tone 保留为前向兼容，不参与适配
- 非流式函数是流式函数的 thin wrapper

### Agent 人格模式（Receiver-side Adaptation）
- Agent 作为文化朋友传话，而非隐形翻译管道
- personality 归接收方，不在协议中传递（SMTP 类比）
- Agent 不只是翻译——也可以是自主社交参与者

### LLM 配置（参考实现）
- 端点: coding.dashscope.aliyuncs.com/v1
- 模型: qwen3-coder-next（1.4s/调用，零 thinking overhead）
- 横评结论: qwen3-coder-next > kimi-k2.5 > qwen3-coder-plus > 其余

---

## Phase 4 公网部署（L3 参考实现）

- tsconfig.json + build/start scripts
- Bearer token auth（GET 公开，POST/DELETE 鉴权，routerApiKey 走环境变量）
- GET /health 健康检查
- Dockerfile multi-stage (node:22-alpine)
- FP 审计修复：routerApiKey 从 CLI 参数改为环境变量 + routerHeaders 消除突变

---

## Phase 4→5 架构转向（2026-03-19）

### 协议对标审计

与 A2A (Google)、MCP (Anthropic)、ACP (Zed) 等 12+ 协议对标后发现：

1. **Chorus 的生态位是唯一的**：所有现有协议都不管"跨文化语义适配"
2. **Chorus 不应与 A2A 竞争基础设施**
3. **Chorus 应叠加在任意通信方式之上**

### 否定清单

| 否定 | 新结论 | 原因 |
|------|-------|------|
| ~~Chorus 需要中心 Router~~ | Router 是 L3 参考实现，非必需 | 协议不应绑定基础设施 |
| ~~Router 是核心产品~~ | L1 协议 + L2 Skill 是核心 | 零部署成本 |
| ~~Chorus 需要自己的发现/认证/传输~~ | L3 生态开放，多种方式共存 | 不重复造轮子 |
| ~~Chorus 强制特定连接方式~~ | P2P/社交网络/第三方/宿主平台均可 | 协议不限制生态 |
| ~~Agent 只是翻译~~ | Agent 可以是自主社交参与者 | 扩展协议价值 |

### npm 分发架构（2026-03-21）

- 包名：`@chorus-protocol/skill`，npm org `chorus-protocol`
- CLI 入口：`cli.mjs`（ESM），支持 `init [--target] [--lang]` + `uninstall --target`
- 4 个 target：`local`（默认）/ `openclaw` / `claude-user` / `claude-project`
- OpenClaw 注册：自动读写 `~/.openclaw/openclaw.json` → `skills.entries.chorus`
- 模板与源同步：`packages/chorus-skill/templates/` 必须与 `skill/` 完全一致（6 对文件）
- 仓库：`github.com/owensun6/chorus`（private）

### 现有代码定位

| 组件 | 定位 |
|------|------|
| `src/shared/types.ts` (envelope schema) | **L1 核心** — 协议 JSON schema |
| `src/agent/llm.ts` (semantic extraction) | **L1/L2 核心** — 协议行为 + Skill prompt 模式 |
| `src/agent/receiver.ts` (cultural adaptation) | **L1/L2 核心** — 协议行为 + Skill receiver 行为 |
| `src/agent/envelope.ts` (envelope creation) | **L1/L2 核心** — 信封构建 |
| `src/server/*` (router) | **L3 参考实现** — 一种可选的连接方式 |
| `src/demo/*` (web demo) | **L3 参考实现** — 展示 Chorus 效果 |

---

## Phase 6 参考实现对齐 v0.4（2026-03-20）

### 核心变更

参考实现 (`src/`) 从 v0.2/v0.3 协议对齐到 v0.4：

| 变更前 | 变更后 | 理由 |
|--------|--------|------|
| `original_semantic` + 语义提取 LLM 调用 | `original_text` = 原始输入 | Agent IS the LLM，不需要"提取语义" |
| `sender_agent_id` + `target_agent_id` + `message`(A2A) | `receiver_id` + `envelope`(裸信封) | 协议定义发裸 envelope |
| `successResponse({ processed: true })` | `{ status: "ok" }` | 协议级响应格式 |
| `ERR_INVALID_BODY` / `ERR_NOT_FOUND` | `ERR_VALIDATION` / `ERR_AGENT_NOT_FOUND` | TRANSPORT.md 标准错误码 |
| `agent-{culture}-{port}` | `agent-{culture}@{host}` | name@host 是 v0.4 规范 |
| 2 次 LLM 调用（semantic + context） | 1 次 LLM 调用（context only） | `original_text` 不需要 LLM |

### 删除清单

- `createChorusMessage()` — A2A 包装函数
- `findChorusDataPart()` — A2A DataPart 搜索
- `extractSemantic()` / `extractSemanticStream()` — 语义提取
- `CHORUS_MEDIA_TYPE` / `CHORUS_EXTENSION_URI` 常量
- `IntentType` / `Formality` / `EmotionalTone` 枚举
- `buildSemanticPrompt()` — 语义提取提示词

### 保留但不再使用

A2A types (`TextPartSchema`, `DataPartSchema`, `A2AMessageSchema`) 保留在 `types.ts` 中，
因为外部可能依赖这些类型。未来可清理。

---

## Phase 6 v0.4 清理 + EXP-01（2026-03-20）

### 清理
- A2A dead types 完全删除（commit 46cbfbb）
- SKILL.md Sending 章节补充 `chorus_version: "0.4"` 为必填字段

### 代码修复
- `src/server/routes.ts`: AbortController timeout (120s) 的 `clearTimeout` 从 try 内移至 finally 块（非流式路径 + 流式路径均修复）。根因：catch 路径不清除 timer → jest worker 无法退出
- 3 个测试文件 `jest.spyOn(global, "fetch")` → 模块级 `global.fetch = jest.fn()`（避免 Node.js undici 初始化）

### EXP-01 外部集成实验
- 验证：外部 Agent 在 SKILL.md + 最小任务提示下可完成 Chorus Server 模式接入
- 接口契约：POST /agents 注册 → POST /messages { receiver_id, envelope } 发送
- 服务端约束：`envelope.sender_id` 必须已注册（ERR_SENDER_NOT_REGISTERED）
- 成功标准 5/5 通过（S-0 注册 / S-1 合法 Envelope / S-2 投递 / S-3 适配文本 / S-4 零人工修正）
- 局限：受控环境、单向通信、单一语言对(en→zh-CN)、高能力 LLM Agent
