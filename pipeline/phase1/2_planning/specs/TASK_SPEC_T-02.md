<!-- Author: Lead -->

# TASK_SPEC_T-02

**任务**: 信封创建/解析/校验模块
**Assignee**: be-domain-modeler
**来源 F-ID**: F1v2
**Blocker**: T-01

## 输入

- `src/shared/types.ts` 中的 ChorusEnvelope 类型 + Zod Schema
- INTERFACE.md 中信封解析算法（按 mediaType 过滤 parts）
- INTERFACE.md 中完整消息示例（A2A 兼容 JSON 结构）

## 输出

- `src/agent/envelope.ts`: 纯函数模块
  - `createEnvelope(semantic, culture, culturalContext?, extras?)` → ChorusEnvelope
  - `createChorusMessage(text, envelope)` → A2AMessage（含 text Part + DataPart）
  - `findChorusDataPart(message)` → ChorusEnvelope | null
  - `parseEnvelope(dataPart)` → ChorusEnvelope（Zod 校验）

## 验收标准（BDD 格式）

- Given: original_semantic="请求会面" 和 sender_culture="zh-CN" 和 cultural_context="中国文化中..."
  When: 调用 createEnvelope()
  Then: 返回对象包含 chorus_version="0.2"、三个必填字段、和 cultural_context

- Given: 一个有效的 ChorusEnvelope 和原始文本
  When: 调用 createChorusMessage(text, envelope)
  Then: 返回 A2AMessage，parts[0] 为 text Part (mediaType: text/plain)，parts[1] 为 DataPart (mediaType: application/vnd.chorus.envelope+json)

- Given: 一个含 Chorus DataPart 的 A2AMessage
  When: 调用 findChorusDataPart(message)
  Then: 返回解析后的 ChorusEnvelope 对象

- Given: 一个不含 Chorus DataPart 的 A2AMessage（只有 text Part）
  When: 调用 findChorusDataPart(message)
  Then: 返回 null

- Given: 一个缺少 sender_culture 的 DataPart
  When: 调用 parseEnvelope()
  Then: 抛出 ZodError

## 测试规格

- 测试文件: `tests/agent/envelope.test.ts`
- test_case_1: createEnvelope — 含 cultural_context 的完整信封
- test_case_2: createEnvelope — 不含 cultural_context 的降级信封
- test_case_3: createChorusMessage — 消息结构正确（2 个 parts, 正确的 mediaType）
- test_case_4: findChorusDataPart — 从有效消息中提取信封
- test_case_5: findChorusDataPart — 无 Chorus DataPart 时返回 null
- test_case_6: parseEnvelope — 无效数据被拒

## 结构性约束测试

- immutability: 所有函数返回新对象，不修改输入参数。断言: 调用后原始输入不变
- error_handling: parseEnvelope 对无效输入抛出明确的 ZodError（非 unhandled crash）
- input_validation: parseEnvelope 通过 Zod 校验所有字段
- auth_boundary: N/A

## 禁止事项

- 禁止引入任何 I/O 操作（HTTP、文件系统、LLM）
- 禁止修改路由服务器代码
- 全部函数必须是纯函数（相同输入 → 相同输出）
