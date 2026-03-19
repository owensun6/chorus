<!-- Author: Lead -->
# TASK_SPEC_T-01
**任务**: 共享类型 v0.3 + ConversationHistory
**Assignee**: be-domain-modeler
**来源 F-ID**: F3.1, F3.3
**Blocker**: None

## 输入
- `src/shared/types.ts` (现有 ChorusEnvelopeSchema, v0.2)
- `spec/chorus-envelope.schema.json` (现有 JSON Schema v0.2)
- `pipeline/phase2/1_architecture/Data_Models.md` (ConversationTurn, ConversationHistory 定义)

## 输出
- `src/shared/types.ts` — 修改:
  - `ChorusEnvelopeSchema.chorus_version`: `z.literal("0.2")` → `z.enum(["0.2", "0.3"])`
  - 新增 `conversation_id: z.string().max(64).optional()`
  - 新增 `turn_number: z.number().int().min(1).optional()`
  - 新增 `ConversationTurnSchema` (Zod) + `ConversationTurn` type, 导出
  - 新增 streaming callback types: `type OnTokenCallback = (chunk: string) => void`
- `src/agent/history.ts` — 新建:
  - `class ConversationHistory { constructor(maxTurns?: number = 10) }`
  - `addTurn(peerId: string, turn: ConversationTurn): void`
  - `getTurns(peerId: string): readonly ConversationTurn[]`
  - `getConversationId(peerId: string): string` (首次调用自动生成 UUID)
  - `getNextTurnNumber(peerId: string): number`
  - FIFO truncation: 超过 maxTurns 时移除最早 turn
- `spec/chorus-envelope.schema.json` — 修改:
  - `chorus_version.const` → `chorus_version.enum: ["0.2", "0.3"]`
  - 新增 `conversation_id` 和 `turn_number` 字段定义

## 验收标准（BDD 格式）
- Given ChorusEnvelopeSchema, When parsing v0.2 envelope (无新字段), Then 解析成功
- Given ChorusEnvelopeSchema, When parsing v0.3 envelope (含 conversation_id + turn_number), Then 解析成功
- Given conversation_id 长度 > 64, When 验证, Then 报错
- Given turn_number = 0, When 验证, Then 报错 (minimum: 1)
- Given ConversationHistory(maxTurns=3), When addTurn 4 次, Then getTurns 返回最近 3 条
- Given 首次调用 getConversationId("peer-a"), When 再次调用, Then 返回相同 UUID

## 测试规格
- 测试文件: `tests/shared/types.test.ts` (追加)
  - test_case_1: v0.3 envelope with conversation_id and turn_number passes validation
  - test_case_2: v0.2 envelope without new fields still passes validation
  - test_case_3: conversation_id exceeding 64 chars rejected
  - test_case_4: turn_number = 0 rejected, turn_number = 1 accepted
- 测试文件: `tests/agent/history.test.ts` (新建)
  - test_case_5: addTurn + getTurns returns immutable array in insertion order
  - test_case_6: FIFO truncation removes oldest when exceeding maxTurns
  - test_case_7: getConversationId returns stable UUID per peerId
  - test_case_8: getConversationId returns different UUIDs for different peers
  - test_case_9: getNextTurnNumber increments per peer

## 结构性约束测试
- immutability: getTurns 返回 readonly array; addTurn 不修改传入的 turn 对象
- error_handling: N/A (纯数据结构，无外部 I/O)
- input_validation: ChorusEnvelopeSchema 的 Zod 约束覆盖所有新字段边界值

## 禁止事项
- 禁止修改 envelope.ts (信封创建/解析逻辑属于 T-02)
- 禁止修改 llm.ts (LLM 函数属于 T-03)
- 禁止引入任何运行时依赖 (UUID 用 crypto.randomUUID)
