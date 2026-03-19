<!-- Author: Lead -->
# TASK_SPEC_T-04
**任务**: Agent 接收端流式响应 — receiver.ts 流式模式
**Assignee**: be-api-router
**来源 F-ID**: F1.2
**Blocker**: T-01, T-03

## 输入
- `src/agent/receiver.ts` (现有 createReceiver, ReceiverConfig, POST /receive)
- `src/agent/llm.ts` (T-03: adaptMessageStream)
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 三 (POST /receive 流式响应)

## 输出
- `src/agent/receiver.ts` — 修改:
  - `ReceiverConfig` 新增可选字段: `history?: ConversationHistory`
  - `POST /receive` 路由逻辑更新:
    - 检测 `Accept: text/event-stream` → 流式模式
    - 流式模式: 调用 `adaptMessageStream(llmClient, envelope, originalText, receiverCulture, historyTurns, onChunk)`, 使用 `c.body(ReadableStream)` 输出 SSE 格式 (event: chunk/done/error)
    - 非流式模式: 保持 Phase 1 行为 (调用 adaptMessage, 返回 JSON)
  - SSE 事件格式:
    - `event: chunk\ndata: {"text": "..."}\n\n`
    - `event: done\ndata: {"full_text": "...", "envelope": {...}}\n\n`
    - `event: error\ndata: {"code": "ERR_ADAPTATION_FAILED", "message": "..."}\n\n`

## 验收标准（BDD 格式）
- Given Accept: text/event-stream, When POST /receive with valid envelope, Then 响应 Content-Type = text/event-stream, 包含 chunk + done 事件
- Given Accept: application/json (或无 Accept), When POST /receive, Then 响应与 Phase 1 完全一致
- Given 流式适配过程中 LLM 抛错, When 处理, Then 发送 error SSE 事件并关闭流
- Given ReceiverConfig.history 已设置, When 流式处理, Then history turns 传入 adaptMessageStream
- Given 无效 JSON body, When POST /receive, Then 返回 400 (无论流式与否)

## 测试规格
- 测试文件: `tests/agent/receiver.test.ts` (追加)
  - test_case_1: streaming response with Accept: text/event-stream contains chunk + done events
  - test_case_2: non-streaming response without Accept header returns JSON (Phase 1 compat)
  - test_case_3: streaming error sends SSE error event
  - test_case_4: history turns passed to adaptMessageStream when config.history set
  - test_case_5: invalid body returns 400 in streaming mode

## 结构性约束测试
- immutability: 不修改传入的 config 或 envelope 对象
- error_handling: LLM 异常 → SSE error 事件 (流式) 或 500 JSON (非流式); body 解析失败 → 400
- input_validation: Accept header 检测使用 `c.req.header("Accept")?.includes("text/event-stream")`

## 禁止事项
- 禁止修改 llm.ts (已由 T-03 完成)
- 禁止修改 routes.ts (属于 T-05)
- 禁止修改 types.ts, envelope.ts
- 禁止在此处实现 ConversationHistory 写入逻辑 (属于 T-06)
