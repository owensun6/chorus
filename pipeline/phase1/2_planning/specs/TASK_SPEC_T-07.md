<!-- Author: Lead -->

# TASK_SPEC_T-07

**任务**: Agent 接收端 HTTP Server
**Assignee**: be-api-router
**来源 F-ID**: F7
**Blocker**: T-02, T-04

## 输入

- `src/agent/envelope.ts`（T-02 产出）中的 findChorusDataPart()、parseEnvelope()
- `src/agent/llm.ts`（T-04 产出）中的 adaptMessage()
- INTERFACE.md 中 POST /receive 契约

## 输出

- `src/agent/receiver.ts`:
  - `createReceiver(port, llmClient, receiverCulture, onMessage)` → HTTP Server
  - POST /receive 处理: 解析信封 → 调用 adaptMessage → 调用 onMessage 回调（显示到 CLI）→ 返回 200

## 验收标准（BDD 格式）

- Given: 一条包含有效 Chorus DataPart 的消息
  When: POST /receive
  Then: 调用 findChorusDataPart 提取信封 → 调用 adaptMessage → 调用 onMessage 回调 → 返回 200 { success: true }

- Given: 一条不含 Chorus DataPart 的消息
  When: POST /receive
  Then: 返回 400，error.code="ERR_INVALID_ENVELOPE"，message 提示未找到 DataPart

- Given: 一条包含 Chorus DataPart 但缺少 original_semantic 的消息
  When: POST /receive
  Then: 返回 400，error.code="ERR_INVALID_ENVELOPE"，message 提示缺少必填字段

- Given: adaptMessage（LLM 调用）失败
  When: POST /receive
  Then: 返回 500，error.code="ERR_ADAPTATION_FAILED"

## 测试规格

- 测试文件: `tests/agent/receiver.test.ts`
- test_case_1: POST /receive — 有效消息，成功处理 + 回调调用（mock LLM）
- test_case_2: POST /receive — 无 Chorus DataPart 返回 400
- test_case_3: POST /receive — 信封缺少必填字段返回 400
- test_case_4: POST /receive — LLM 适配失败返回 500

## 结构性约束测试

- immutability: 不修改传入的 message 对象
- error_handling: LLM 超时/失败 → 500 ERR_ADAPTATION_FAILED（非 unhandled crash）；信封校验失败 → 400 ERR_INVALID_ENVELOPE
- input_validation: 通过 findChorusDataPart + parseEnvelope 校验入参
- auth_boundary: N/A

## 禁止事项

- 禁止修改路由服务器代码
- 禁止修改 envelope.ts 或 llm.ts 的逻辑
- 禁止在 receiver 中直接构造提示词（那是 llm.ts 的职责）
