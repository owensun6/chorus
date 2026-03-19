<!-- Author: Lead -->
# TASK_SPEC_T-06
**任务**: Agent 生命周期升级 — ConversationHistory + streaming + v0.3 信封
**Assignee**: be-domain-modeler
**来源 F-ID**: F1.4, F3.1, F3.2, F3.3
**Blocker**: T-02, T-03, T-04

## 输入
- `src/agent/index.ts` (现有 startAgent, sendMessage, parseArgs)
- `src/agent/history.ts` (T-01: ConversationHistory)
- `src/agent/envelope.ts` (T-02: v0.3 createEnvelope)
- `src/agent/llm.ts` (T-03: extractSemanticStream, adaptMessageStream)
- `src/agent/receiver.ts` (T-04: 流式 receiver)

## 输出
- `src/agent/index.ts` — 修改:
  - startAgent 内部创建 `ConversationHistory` 实例
  - `sendMessage(targetId, text)` 改为:
    1. 调用 `extractSemanticStream(llmClient, text, culture, onToken)` — onToken 用于 CLI 状态显示
    2. `createEnvelope(semantic, culture, context, { ...extras, conversation_id: history.getConversationId(targetId), turn_number: history.getNextTurnNumber(targetId) })`
    3. 发送 POST /messages 到 router, body 含 `stream: true`
    4. 读取 SSE 响应流, 逐 chunk 调用 `process.stdout.write(text)` (CLI 逐字显示)
    5. 完成后调用 `history.addTurn(targetId, { role: "sent", originalText, adaptedText, envelope, timestamp })`
  - `onMessage` 回调 (receiver) 更新:
    1. `process.stdout.write` 逐字显示 (流式 receiver 已处理)
    2. `history.addTurn(senderId, { role: "received", originalText, adaptedText, envelope, timestamp })`
  - createReceiver 配置新增 `history` 字段传入

## 验收标准（BDD 格式）
- Given Agent 启动, When sendMessage 发送首条消息, Then 信封 chorus_version = "0.3" 含 conversation_id + turn_number = 1
- Given Agent 发送第 2 条消息给同一 target, When 生成信封, Then conversation_id 不变, turn_number = 2
- Given sendMessage 完成, When 查询 history.getTurns(targetId), Then 包含该轮 role="sent" 记录
- Given receiver 收到消息, When onMessage 触发, Then history 包含 role="received" 记录
- Given stream SSE 响应含 3 个 chunk, When CLI 处理, Then process.stdout.write 被调用 3 次

## 测试规格
- 测试文件: `tests/agent/index.test.ts` (追加)
  - test_case_1: sendMessage creates v0.3 envelope with conversation_id and turn_number
  - test_case_2: consecutive sendMessage increments turn_number
  - test_case_3: sendMessage records sent turn in history
  - test_case_4: onMessage callback records received turn in history
  - test_case_5: streaming response chunks written to stdout

## 结构性约束测试
- immutability: sendMessage 不修改传入 text; history.addTurn 接收新 turn 对象
- error_handling: extractSemanticStream 失败 → 抛错不写 history; SSE 流中断 → 已收 chunk 保留, 输出错误
- input_validation: targetId 必须非空 (由上游 registry 保证)

## 禁止事项
- 禁止修改 llm.ts, envelope.ts, receiver.ts 的函数签名
- 禁止修改 routes.ts, registry.ts
- 禁止直接操作 ConversationHistory 内部 Map (只通过公开方法)
