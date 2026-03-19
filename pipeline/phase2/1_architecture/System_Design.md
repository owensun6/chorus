<!-- Author: Lead -->

# System Design — Chorus Protocol Phase 2

## Phase 1 → Phase 2 变更总览

| 维度 | Phase 1 | Phase 2 |
|------|---------|---------|
| LLM 调用 | 阻塞式（等完整响应） | 流式（逐 token 返回） |
| 消息转发 | 请求-响应（同步） | 流式透传（chunked response） |
| 用户界面 | CLI readline | CLI（流式） + Web Demo UI |
| 对话模式 | 单条消息独立处理 | 多轮上下文（近 N 轮注入） |
| 信封版本 | v0.2 | v0.3（新增 conversation_id, turn_number） |
| 进程模型 | 3 个独立进程 | 保留 + 新增 Demo 编排器（单进程启动全部） |

## 组件图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Demo Orchestrator (新增)                       │
│  一键启动: Router + Agent-zh + Agent-ja + Web Server             │
│  暴露 SSE 端点供 Web UI 订阅实时事件                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐  │
│  │  Web UI (浏览器)  │◄──│  Static File Server (:5000)         │  │
│  │  双栏 + 元数据面板 │   │  GET /  → index.html               │  │
│  │  SSE 实时流       │◄──│  GET /events → SSE 事件流           │  │
│  │  POST /api/send   │──►│  POST /api/send → 编排发送流程      │  │
│  └─────────────────┘    └─────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Routing Server (:3000) [Phase 1 保留]          │  │
│  │  POST /agents, GET /agents, DELETE /agents                  │  │
│  │  POST /messages — 流式透传（Phase 2 升级）                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │  Agent-zh (:3001)     │  │  Agent-ja (:3002)     │             │
│  │  POST /receive        │  │  POST /receive        │             │
│  │  → 流式 adaptMessage  │  │  → 流式 adaptMessage  │             │
│  │  + 对话历史管理        │  │  + 对话历史管理        │             │
│  └──────────────────────┘  └──────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

## 关键架构决策

### ADR-P2-001: 流式透传架构

**问题**: Agent B 的 LLM adaptMessage 调用需要 30-60 秒，用户体验不可接受。

**决策**: HTTP chunked response 逐层透传。

```
Agent B LLM (stream: true)
  → Agent B /receive (chunked HTTP response)
    → Router /messages (pipe Agent B's response)
      → Agent A / Web UI (逐字显示)
```

**不选 WebSocket 的原因**: 消息流是单向的（目标→发送方），SSE/chunked 已足够，WebSocket 增加复杂度但无收益。

**不选独立 SSE 端点的原因**: 复用 POST /messages 的 HTTP 响应通道，无需额外连接管理。

### ADR-P2-002: Demo 编排器（单进程模式）

**问题**: Phase 1 需要手动启动 3 个进程（router + 2 agents），不适合演示。

**决策**: 新增 `src/demo/index.ts`，一个进程内启动全部组件 + Web 服务器。

```typescript
// 伪代码
const router = startRouter(3000);
const agentZh = startAgent({ culture: "zh-CN", port: 3001 });
const agentJa = startAgent({ culture: "ja", port: 3002 });
const web = startWebServer(5000);  // 静态文件 + SSE + /api/send
open("http://localhost:5000");
```

Phase 1 的独立进程 CLI 模式保留不变。

### ADR-P2-003: 对话历史——Agent 本地内存

**问题**: 多轮对话需要上下文，历史存哪里？

**决策**: Agent 进程内存，Map<conversationId, Turn[]>。不引入数据库。

**理由**: Phase 2 仍为 demo 级别（2 Agent），重启即清空可接受。持久化留给 Phase 3。

## 流式消息发送流程（核心路径升级）

```
User A 输入 "你吃了吗？"
    ↓
Agent A: extractSemantic(stream=true)
    ↓ [阻塞等待完整 JSON — 但 Web UI 显示"提取中..."]
    ↓ 获得 {original_semantic, cultural_context, ...}
    ↓
Agent A: createEnvelope(v0.3, conversation_id, turn_number)
    ↓
Agent A: POST /messages → Router
    ↓
Router: 查找 Agent B endpoint → POST /receive
    ↓
Agent B: parseEnvelope → adaptMessage(stream=true)
    ↓ LLM 流式返回文本
    ↓ Agent B 写入 chunked HTTP response
    ↓
Router: pipe Agent B 的 chunked response → Agent A
    ↓
Agent A / Web UI: 逐字显示适配文本
    ↓
Agent B: 保存到对话历史 (turn N)
Agent A: 收到完整响应后保存到对话历史
```

**extractSemantic 为什么不流式显示？** 因为它返回结构化 JSON（original_semantic + cultural_context + intent_type...），必须等完整 JSON 才能创建信封。但 Web UI 可以显示"思考中"状态。

## 目录结构变更

```
src/
├── agent/
│   ├── index.ts          # 更新: 对话追踪 + 流式显示
│   ├── envelope.ts       # 更新: v0.3 字段
│   ├── llm.ts            # 更新: stream 参数支持
│   ├── receiver.ts       # 更新: 流式 HTTP 响应
│   ├── discovery.ts      # 不变
│   └── history.ts        # 新增: 对话历史管理
├── server/
│   ├── index.ts          # 更新: 导出 startRouter()
│   ├── routes.ts         # 更新: 流式转发
│   ├── registry.ts       # 不变
│   └── validation.ts     # 更新: v0.3 schema
├── shared/
│   ├── types.ts          # 更新: v0.3 类型 + streaming 类型
│   └── response.ts       # 不变
├── demo/                  # 新增
│   ├── index.ts          # Demo 编排器入口
│   └── web.ts            # Web 服务器 (静态文件 + SSE + API)
└── web/                   # 新增
    └── index.html         # 单页 Demo UI (HTML + Tailwind CDN + 内联 JS)
```

## 安全边界标注（Phase 2 增量）

| 检查点 | 位置 | 措施 |
|--------|------|------|
| SSE 连接 | Web Server /events | 仅 localhost 监听，无鉴权（demo 级别） |
| 对话历史 | Agent 内存 | 不持久化，不传输，重启清空 |
| Web UI 输入 | POST /api/send | Zod 校验 from/to/text 字段 |
