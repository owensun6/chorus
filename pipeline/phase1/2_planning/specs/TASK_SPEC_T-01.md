<!-- Author: Lead -->

# TASK_SPEC_T-01

**任务**: 共享类型 + Zod Schema + 协议规范 v0.2
**Assignee**: be-domain-modeler
**来源 F-ID**: F1v2, F2v2
**Blocker**: None

## 输入

- INTERFACE.md 中 ChorusEnvelope v0.2 字段定义
- INTERFACE.md 中 ChorusAgentCardExtension v0.2 字段定义
- Data_Models.md 中所有实体定义（ChorusEnvelope, AgentCard, AgentRegistration, MessagePayload, A2AMessage, Part）
- 现有 `spec/chorus-envelope.schema.json` (v0.1)
- 现有 `spec/chorus-agent-card.schema.json` (v0.1)

## 输出

- `src/shared/types.ts`: 全部 TypeScript 接口 + Zod Schema
- `spec/chorus-envelope.schema.json`: 更新至 v0.2（新增 cultural_context, additionalProperties: true, 移除 relationship_level）
- `spec/chorus-agent-card.schema.json`: 更新至 v0.2（移除 communication_preferences, additionalProperties: true）
- `package.json`: 新增 hono, openai 依赖（npm install）

## 验收标准（BDD 格式）

- Given: 一个包含全部必填字段的 ChorusEnvelope v0.2 对象
  When: 用 ChorusEnvelopeSchema.parse() 校验
  Then: 校验通过，返回类型安全的对象

- Given: 一个缺少 original_semantic 的 ChorusEnvelope 对象
  When: 用 ChorusEnvelopeSchema.parse() 校验
  Then: 抛出 ZodError，错误路径包含 "original_semantic"

- Given: 一个 cultural_context 长度为 5 的信封（低于 minLength 10）
  When: 用 ChorusEnvelopeSchema.parse() 校验
  Then: 抛出 ZodError，错误信息提示长度不足

- Given: 一个 cultural_context 长度为 501 的信封（超出 maxLength 500）
  When: 用 ChorusEnvelopeSchema.parse() 校验
  Then: 抛出 ZodError，错误信息提示长度超限

- Given: 一个 ChorusAgentCardExtension v0.2 对象（无 communication_preferences）
  When: 用 AgentCardSchema.parse() 校验
  Then: 校验通过

- Given: spec/chorus-envelope.schema.json 文件
  When: 读取并检查内容
  Then: $id 含 "v0.2"，properties 含 cultural_context，additionalProperties 为 true

## 测试规格

- 测试文件: `tests/shared/types.test.ts`
- test_case_1: ChorusEnvelope v0.2 — 全部必填字段通过校验
- test_case_2: ChorusEnvelope v0.2 — 缺少 original_semantic 被拒
- test_case_3: ChorusEnvelope v0.2 — cultural_context 过短被拒
- test_case_4: ChorusEnvelope v0.2 — cultural_context 过长被拒
- test_case_5: AgentCard v0.2 — 无 communication_preferences 通过
- test_case_6: JSON Schema 文件 — v0.2 内容正确

## 结构性约束测试

- immutability: Zod schema parse 返回新对象，不可变。断言: `Object.isFrozen(parsed)` 或 readonly 类型
- error_handling: N/A（纯类型定义，无 I/O）
- input_validation: Zod Schema 本身就是校验逻辑，已覆盖
- auth_boundary: N/A

## 禁止事项

- 禁止编写任何 HTTP 路由代码
- 禁止编写任何 LLM 调用代码
- 禁止在 types.ts 中引入任何外部 I/O 依赖
