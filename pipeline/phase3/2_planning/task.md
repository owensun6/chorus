<!-- Author: Lead -->

# Phase 3 实施计划与并发检查单 (Execution Plan)

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明，无额外 Phase 闸门约束。

## [Phase 1] Schema + 配置（无依赖，完全并行）

- [ ] T-01 `[Assignee: be-domain-modeler]`: 在 `src/shared/types.ts` 的 `ChorusAgentCardSchema` 中新增 `personality` 可选字段（`z.string().max(200).optional()`），更新 `ChorusAgentCard` 类型 (Blocker: None)
- [ ] T-02 `[Assignee: be-domain-modeler]`: 在 `src/agent/config.ts` 的 `AgentConfig` 接口中新增 `personality?: string` 字段，`parseArgs` 支持 `--personality` 参数 (Blocker: None)

## [Phase 2] 数据透传链路（按 Blocker 自然解锁）

- [ ] T-03 `[Assignee: be-api-router]`: 修改 `src/server/routes.ts` 的消息转发逻辑 — 在 `POST /messages` 中从 `registry.get(sender_agent_id)` 取出发送方 `agent_card.personality`，附加到转发给 target 的 JSON body 中（新增 `sender_personality` 字段） (Blocker: T-01)
- [ ] T-04 `[Assignee: be-api-router]`: 修改 `src/agent/receiver.ts` — 从转发请求 body 中读取 `sender_personality`，传给 `adaptMessage` / `adaptMessageStream` / `handleStreaming` (Blocker: T-01)

## [Phase 3] LLM 适配感知（按 Blocker 自然解锁）

- [ ] T-05 `[Assignee: be-ai-integrator]`: 修改 `src/agent/llm.ts` 的 `buildReceiverPrompt` — 新增 `senderPersonality?: string` 参数，有值时在 prompt 中插入"对方的沟通风格: {personality}"段落，无值时省略（保持默认行为） (Blocker: T-04)

## [Phase 4] Agent 注册 + Demo 集成（按 Blocker 自然解锁）

- [ ] T-06 `[Assignee: be-domain-modeler]`: 修改 `src/agent/index.ts` 的 `startAgent` — 将 `config.personality` 写入注册 body 的 `agent_card.personality` 字段 (Blocker: T-01, T-02)
- [ ] T-07 `[Assignee: be-domain-modeler]`: 修改 `src/demo/index.ts` 的 `startDemo` — 为 zh-CN agent 设定 `personality: "热情直爽的北京大哥，说话接地气，爱用口语化表达"`, ja agent 设定 `personality: "礼貌细腻的东京白领，注重措辞得体，表达含蓄委婉"` (Blocker: T-06)
