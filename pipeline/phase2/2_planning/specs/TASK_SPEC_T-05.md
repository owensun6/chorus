<!-- Author: Lead -->
# TASK_SPEC_T-05
**任务**: 路由服务器流式转发 — POST /messages stream=true
**Assignee**: be-api-router
**来源 F-ID**: F1.3
**Blocker**: T-04

## 输入
- `src/server/routes.ts` (现有 createApp, POST /messages)
- `src/server/validation.ts` (现有 MessagePayloadBodySchema)
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 三 (POST /messages 流式响应)

## 输出
- `src/server/validation.ts` — 修改:
  - `MessagePayloadBodySchema` 新增可选字段: `stream: z.boolean().optional().default(false)`
- `src/server/routes.ts` — 修改:
  - `POST /messages` 路由逻辑更新:
    - `stream=false` (默认): 行为与 Phase 1 完全一致
    - `stream=true`:
      - 向 Agent endpoint 发 fetch 请求, 附加 `Accept: text/event-stream`
      - 响应 Content-Type: `text/event-stream`
      - 使用 `c.body(response.body)` 直接 pipe Agent 的 ReadableStream
      - Agent 不可达时发送 SSE error 事件后关闭流

## 验收标准（BDD 格式）
- Given stream=true in body, When POST /messages 且目标 Agent 返回 SSE 流, Then Router 透传流给客户端, Content-Type = text/event-stream
- Given stream=false (或缺省), When POST /messages, Then 行为与 Phase 1 完全一致
- Given stream=true, When 目标 Agent 不可达, Then Router 返回 SSE error 事件
- Given stream=true, When 目标 Agent 返回 500, Then Router 发送 SSE error 事件
- Given 无效 body (缺少 target_agent_id), When POST /messages, Then 返回 400 JSON (无论 stream 值)

## 测试规格
- 测试文件: `tests/server/routes.test.ts` (追加)
  - test_case_1: stream=true pipes SSE from mock target agent
  - test_case_2: stream=false returns JSON response (Phase 1 compat)
  - test_case_3: stream=true with unreachable agent returns SSE error
  - test_case_4: stream=true with agent 500 returns SSE error
  - test_case_5: validation error returns 400 JSON regardless of stream flag

## 结构性约束测试
- immutability: 不修改 registry 状态; 不修改 request body
- error_handling: Agent 不可达 → SSE error event (stream) 或 502 JSON (non-stream); timeout → abort + error
- input_validation: stream 字段由 Zod schema 验证 (boolean, default false)

## 禁止事项
- 禁止修改 receiver.ts (属于 T-04)
- 禁止修改 registry.ts 的接口
- 禁止修改 llm.ts, types.ts, envelope.ts
- 禁止自行实现 SSE 编码 — 直接 pipe Agent 响应流
