<!-- Author: Lead -->
# TASK_SPEC_T-03
**任务**: LLM 流式函数 — extractSemanticStream + adaptMessageStream
**Assignee**: be-ai-integrator
**来源 F-ID**: F1.1, F1.2, F3.2
**Blocker**: T-01

## 输入
- `src/agent/llm.ts` (现有 extractSemantic, adaptMessage, prompt 模板)
- `src/shared/types.ts` (T-01: ConversationTurn, OnTokenCallback)
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 二 (函数签名)

## 输出
- `src/agent/llm.ts` — 追加 (保留所有 Phase 1 函数不变):
  - `extractSemanticStream(client: OpenAI, userInput: string, senderCulture: string, onToken?: (chunk: string) => void, model?: string): Promise<ExtractResult>`
    - 调用 `client.chat.completions.create({ stream: true })`, 迭代 async iterator
    - 每个 delta.content 调用 onToken, 拼接完整响应后 JSON.parse
  - `adaptMessageStream(client: OpenAI, envelope: ChorusEnvelope, originalText: string, receiverCulture: string, history?: ConversationTurn[], onChunk?: (text: string) => void, model?: string): Promise<string>`
    - 构建含 history 上下文的 prompt (将 history 格式化为对话摘要注入)
    - 调用 `client.chat.completions.create({ stream: true })`, 迭代 async iterator
    - 每个 delta.content 调用 onChunk, 返回完整文本
  - 新增内部函数 `buildReceiverPromptWithHistory(envelope, originalText, receiverCulture, history?)` — 在现有 prompt 基础上注入历史上下文

## 验收标准（BDD 格式）
- Given mock streaming iterator 返回 3 个 chunk, When extractSemanticStream, Then onToken 被调用 3 次, 最终返回 ExtractResult
- Given 流式响应返回非法 JSON, When extractSemanticStream, Then 抛出 "failed to parse LLM response"
- Given history 含 2 轮对话, When adaptMessageStream, Then prompt 包含历史上下文摘要
- Given history 为 undefined, When adaptMessageStream, Then 行为与 Phase 1 adaptMessage 一致 (降级)
- Given onChunk 回调, When adaptMessageStream 流式返回, Then onChunk 按顺序收到每个 chunk

## 测试规格
- 测试文件: `tests/agent/llm.test.ts` (追加)
  - test_case_1: extractSemanticStream calls onToken for each chunk
  - test_case_2: extractSemanticStream returns valid ExtractResult from concatenated chunks
  - test_case_3: extractSemanticStream throws on invalid JSON response
  - test_case_4: adaptMessageStream calls onChunk for each text delta
  - test_case_5: adaptMessageStream returns full concatenated text
  - test_case_6: adaptMessageStream injects history into prompt (inspect messages arg)
  - test_case_7: adaptMessageStream without history produces same prompt as Phase 1

## 结构性约束测试
- immutability: history 参数为 readonly array, 函数不修改; 返回新 string/object
- error_handling: stream 中断 → 抛错并附带已收集长度信息; JSON parse 失败 → 明确错误
- input_validation: 依赖 T-01 的 Zod schema (函数入参类型由 TypeScript 保证)

## 禁止事项
- 禁止修改 Phase 1 的 extractSemantic / adaptMessage 函数签名或行为
- 禁止修改 receiver.ts, routes.ts, envelope.ts
- 禁止在此文件中实现 HTTP 层逻辑 (chunked response 属于 T-04)
