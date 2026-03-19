<!-- Author: Lead -->
# TASK_SPEC_T-02
**任务**: 信封 v0.3 — createEnvelope / parseEnvelope 升级
**Assignee**: be-domain-modeler
**来源 F-ID**: F3.3
**Blocker**: T-01

## 输入
- `src/agent/envelope.ts` (现有 createEnvelope, parseEnvelope, findChorusDataPart)
- `src/shared/types.ts` (T-01 已更新的 ChorusEnvelopeSchema)
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 一 (Envelope v0.3 契约)

## 输出
- `src/agent/envelope.ts` — 修改:
  - `EnvelopeExtras` 新增: `conversation_id?: string`, `turn_number?: number`
  - `createEnvelope(semantic, culture, culturalContext?, extras?)` — extras 含新字段时写入信封, chorus_version 根据是否有新字段自动选 "0.3" 或 "0.2"
  - `parseEnvelope(data)` — 无需改动 (T-01 已更新 Schema 支持双版本)
  - `findChorusDataPart(message)` — 无需改动 (依赖 Schema 已兼容)

## 验收标准（BDD 格式）
- Given extras 含 conversation_id + turn_number, When createEnvelope, Then 信封 chorus_version = "0.3" 且含两个新字段
- Given extras 不含 conversation_id 和 turn_number, When createEnvelope, Then 信封 chorus_version = "0.2" (向后兼容)
- Given v0.2 信封数据, When parseEnvelope, Then 解析成功且无 conversation_id/turn_number
- Given v0.3 信封数据, When parseEnvelope, Then 解析成功且含 conversation_id + turn_number
- Given A2AMessage 含 v0.3 DataPart, When findChorusDataPart, Then status = "found" 且 envelope 含新字段

## 测试规格
- 测试文件: `tests/agent/envelope.test.ts` (追加)
  - test_case_1: createEnvelope with conversation_id + turn_number produces v0.3
  - test_case_2: createEnvelope without new fields produces v0.2
  - test_case_3: parseEnvelope accepts v0.2 data
  - test_case_4: parseEnvelope accepts v0.3 data with new fields
  - test_case_5: findChorusDataPart extracts v0.3 envelope from A2AMessage

## 结构性约束测试
- immutability: createEnvelope 返回新对象, 不修改 extras 入参
- error_handling: parseEnvelope 对非法数据抛 ZodError (继承自 Phase 1)
- input_validation: conversation_id maxLength 64 / turn_number min 1 由 Schema 保证

## 禁止事项
- 禁止修改 types.ts (已由 T-01 完成)
- 禁止修改 llm.ts, receiver.ts, routes.ts
- 禁止删除 Phase 1 已有的导出符号
