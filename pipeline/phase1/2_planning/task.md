<!-- Author: Lead -->

# 实施计划 (Execution Plan) — Phase 1

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明，无额外 Phase 闸门约束。

## [Phase 1] 基础层（无依赖）

- [ ] T-01 `[Assignee: be-domain-modeler]`: 共享类型 + Zod Schema + 协议规范 v0.2 — 创建 `src/shared/types.ts`（全部 TypeScript 接口 + Zod Schema）+ 更新 `spec/` 下 JSON Schema 和提示词模板文档至 v0.2 + 安装新依赖（hono, openai） (Blocker: None)

## [Phase 2] 核心模块（均仅依赖 T-01，4 路并发）

- [ ] T-02 `[Assignee: be-domain-modeler]`: 信封创建/解析/校验 — 创建 `src/agent/envelope.ts`，实现 createEnvelope()、parseEnvelope()、findChorusDataPart() 纯函数 (Blocker: T-01)
- [ ] T-03 `[Assignee: be-domain-modeler]`: Agent Card 校验 + 语言匹配 — 创建 `src/agent/discovery.ts`，实现 canCommunicate()、discoverCompatibleAgents() (Blocker: T-01)
- [ ] T-04 `[Assignee: be-ai-integrator]`: LLM 客户端 + 提示词 — 创建 `src/agent/llm.ts`，实现 extractSemantic()（发送端提取）、adaptMessage()（接收端适配）。使用 openai 包 + Dashscope 兼容端点 (Blocker: T-01)
- [ ] T-05 `[Assignee: be-api-router]`: 路由服务器 — Agent CRUD — 创建 `src/server/registry.ts` + `src/server/routes.ts` + `src/server/validation.ts`，实现 POST/GET/DELETE /agents 四个端点 + 内存 Map 注册表 (Blocker: T-01)

## [Phase 3] 集成层（按 Blocker 解锁）

- [ ] T-06 `[Assignee: be-api-router]`: 路由服务器 — 消息转发 + 入口 — 在 routes.ts 追加 POST /messages 端点（透传 + target_response 包装）+ 创建 `src/server/index.ts` 服务器入口 (Blocker: T-05)
- [ ] T-07 `[Assignee: be-api-router]`: Agent 接收端 — 创建 `src/agent/receiver.ts`，实现 POST /receive 端点（解析信封 → 调用 LLM 适配 → CLI 输出） (Blocker: T-02, T-04)

## [Phase 4] 组装层

- [ ] T-08 `[Assignee: be-domain-modeler]`: Agent CLI 入口 + 生命周期 — 创建 `src/agent/index.ts`，实现 CLI 参数解析 + 启动流程（HTTP server → 注册 → 发现 → readline 循环）+ 关闭流程（SIGINT → 注销 → 退出） (Blocker: T-02, T-03, T-04, T-07)
