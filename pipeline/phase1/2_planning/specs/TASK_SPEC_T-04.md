<!-- Author: Lead -->

# TASK_SPEC_T-04

**任务**: LLM 客户端 + 提示词模板
**Assignee**: be-ai-integrator
**来源 F-ID**: F3v2
**Blocker**: T-01

## 输入

- `src/shared/types.ts` 中的 ChorusEnvelope 类型
- INTERFACE.md 中发送端提示词模板（extractSemantic: user_input + sender_culture → JSON）
- INTERFACE.md 中接收端提示词模板（adaptMessage: envelope + receiver_culture → text）
- PRD 中 LLM 无关性要求（使用 openai 包 + Dashscope 兼容端点）

## 输出

- `src/agent/llm.ts`:
  - `createLLMClient(apiKey, baseUrl?)` → OpenAI client
  - `extractSemantic(client, userInput, senderCulture)` → { original_semantic, cultural_context, intent_type?, formality?, emotional_tone? }
  - `adaptMessage(client, envelope, originalText, receiverCulture)` → string（适配后的文本）
- `spec/chorus-prompt-template.md`: 更新至 v0.2（发送端 + 接收端模板）

## 验收标准（BDD 格式）

- Given: 有效的 API Key 和 Dashscope base URL
  When: 调用 createLLMClient()
  Then: 返回可用的 OpenAI client 对象

- Given: userInput="你怎么这么胖？" 和 senderCulture="zh-CN"
  When: 调用 extractSemantic()（mock LLM 返回有效 JSON）
  Then: 返回对象包含 original_semantic（非空字符串）和 cultural_context（10-500 字符）

- Given: LLM 返回无效 JSON（非 JSON 文本）
  When: 调用 extractSemantic()
  Then: 抛出明确错误，包含 "failed to parse LLM response"

- Given: LLM 返回的 cultural_context 为空字符串
  When: 调用 extractSemantic()
  Then: 返回对象中 cultural_context 为 undefined（降级处理，不抛异常）

- Given: 有效的 ChorusEnvelope（含 cultural_context）和 receiverCulture="ja"
  When: 调用 adaptMessage()（mock LLM 返回日文文本）
  Then: 返回非空字符串

- Given: LLM API 调用超时
  When: 调用 extractSemantic() 或 adaptMessage()
  Then: 抛出错误，包含 "LLM request timeout"

## 测试规格

- 测试文件: `tests/agent/llm.test.ts`
- test_case_1: extractSemantic — 正常提取（mock LLM 返回有效 JSON）
- test_case_2: extractSemantic — LLM 返回无效 JSON 时报错
- test_case_3: extractSemantic — cultural_context 为空时降级（返回 undefined）
- test_case_4: adaptMessage — 正常适配（mock LLM 返回文本）
- test_case_5: adaptMessage — LLM 超时时报错
- test_case_6: createLLMClient — 创建客户端成功

## 结构性约束测试

- immutability: extractSemantic 不修改输入参数
- error_handling: LLM API 超时/错误/无效响应均有明确的错误处理路径，不静默吞错
- input_validation: extractSemantic 校验 LLM 返回的 JSON 结构（cultural_context 长度检查）
- auth_boundary: N/A（API Key 从环境变量读取，不在代码中硬编码）

## 禁止事项

- 禁止硬编码 API Key
- 禁止修改路由服务器代码
- 禁止修改信封创建/解析逻辑（那是 T-02 的职责）
- 禁止在代码中写死 Dashscope URL（必须可配置）
