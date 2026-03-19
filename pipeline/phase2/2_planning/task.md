<!-- Author: Lead -->

# 实施计划 (Execution Plan) — Phase 2

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明，无额外 Phase 闸门约束。

## [Phase 1] 基础层（无依赖，2 路并发）

- [ ] T-01 `[Assignee: be-domain-modeler]`: 共享类型 v0.3 + ConversationHistory — 更新 `src/shared/types.ts`（v0.3 信封字段 + ConversationTurn 类型），新建 `src/agent/history.ts`（ConversationHistory 类），更新 `spec/` JSON Schema 至 v0.3 (Blocker: None)
- [ ] T-07 `[Assignee: fe-ui-builder]`: Web Demo UI — 创建 `src/web/index.html`（双栏布局 + 信封元数据面板 + SSE 实时流 + Tailwind CDN），纯静态 HTML + 内联 JS，无框架依赖 (Blocker: None)

## [Phase 2] 核心模块（依赖 T-01，3 路并发）

- [ ] T-02 `[Assignee: be-domain-modeler]`: 信封 v0.3 — 更新 `src/agent/envelope.ts`，createEnvelope 接受 conversation_id + turn_number，parseEnvelope 兼容 v0.2 和 v0.3 (Blocker: T-01)
- [ ] T-03 `[Assignee: be-ai-integrator]`: LLM 流式函数 — 在 `src/agent/llm.ts` 新增 extractSemanticStream() + adaptMessageStream()，使用 OpenAI SDK stream:true，支持 onChunk 回调 + history 上下文注入 (Blocker: T-01)
- [ ] T-04 `[Assignee: be-api-router]`: Agent 接收端流式响应 — 更新 `src/agent/receiver.ts`，检测 Accept header 切换流式模式，使用 adaptMessageStream，chunked HTTP response (Blocker: T-01, T-03)

## [Phase 3] 集成层（按 Blocker 解锁）

- [ ] T-05 `[Assignee: be-api-router]`: 路由服务器流式转发 — 更新 `src/server/routes.ts`，POST /messages 支持 stream=true，pipe Agent 的 chunked response (Blocker: T-04)
- [ ] T-06 `[Assignee: be-domain-modeler]`: Agent 生命周期升级 — 更新 `src/agent/index.ts`，集成 ConversationHistory + streaming + v0.3 信封，CLI 逐字显示 (Blocker: T-02, T-03, T-04)

## [Phase 4] 组装层

- [ ] T-08 `[Assignee: be-api-router]`: Demo 编排器 + Web 服务器 — 新建 `src/demo/index.ts` + `src/demo/web.ts`，一键启动全部组件 + 静态文件服务 + SSE 事件广播 + POST /api/send (Blocker: T-05, T-06, T-07)
