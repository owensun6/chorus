# Handoff — 2026-03-20

## ⚡ 立即行动（第一步）

无阻塞任务。读取 `pipeline/monitor.md` 确认状态，等待 Commander 下一步指令。协议标准 + 参考实现已完全对齐 v0.4。

---

## 当前状态

- **项目**: Chorus — 跨平台 Agent 通信标准
- **Stage**: Phase 5 整改完成 + Phase 6 参考实现对齐完成
- **Gate 状态**: 全部已通过（Phase 0→5 所有 Gate ✅）
- **阻塞点**: 无。协议标准与参考实现完全对齐 v0.4

---

## 本会话完成事项

### Commit 67ab683: Phase 5 全量提交
- 78 files, +4053 lines
- 协议标准：PROTOCOL.md v0.4 + SKILL.md + TRANSPORT.md (298 行)
- npm CLI：`packages/chorus-skill/` (`npx @chorus-protocol/skill init`)
- 跨平台验证：5/5 PASS
- Gene Bank：7 条经验 Gene
- 所有 Phase 文档 + 统一 PRD v2.0

### Commit d8f4f5d: Phase 6 参考实现对齐 v0.4
- 18 files, -868 +393 lines (net -475)
- `types.ts`: Envelope v0.4 — `sender_id`(name@host) + `original_text` 替代 `original_semantic`，删除 v0.3 扩展字段
- `routes.ts` + `validation.ts`: `sender_agent_id`+`target_agent_id`+`message`(A2A) → `receiver_id`+`envelope`(裸信封)
- `llm.ts`: `extractSemanticStream` → `generateCulturalContext`（删除语义提取 LLM 调用，2 次→1 次）
- `receiver.ts`: 接收 `{ envelope }` 直接验证，返回 `{ status: "ok" }`
- `config.ts`: Agent ID 默认 `agent-{culture}@{host}`
- 错误码对齐：`ERR_SENDER_NOT_REGISTERED`, `ERR_AGENT_NOT_FOUND`, `ERR_VALIDATION`
- 响应加 `delivery: "delivered"` 字段
- `web/index.html`: UI 字段名对齐 v0.4
- 8 个测试文件全部重写
- 141 tests PASS, tsc 零错误, coverage 82.82%

### Gene Bank 新增 3 条
- `principle-original-text-not-semantic.md` — Agent IS the LLM，不需要语义提取
- `pattern-naked-envelope-transport.md` — 裸信封传输优于协议包装
- `heuristic-delete-lowers-bug-surface.md` — 净删除行数是重构质量指标

---

## 待完成（按优先级）

1. [P2] A2A 类型清理 — `TextPartSchema`/`DataPartSchema`/`A2AMessageSchema` 保留在 `types.ts` 但不再被使用，可安全删除。依赖：确认无外部引用
2. [P2] `agent_card.chorus_version` 与 `envelope.chorus_version` 同名不同义（"0.2" vs "0.4"）— 验证 agent 标记为"最易混淆的点"，未来考虑改名
3. [P2] E2E Playwright 测试更新 — `tests/e2e/demo.test.ts` 可能需要对齐新的 API 格式（demo 层未改）
4. [P3] npm CLI 中 PROTOCOL.md/SKILL.md 模板与 `skill/` 目录保持同步
5. [P3] 跨服务器投递（federation）明确标为 out of scope — 验证 agent 发现了缺口但理解是预期的

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| A2A 包装层完全移除 | 发送裸 envelope `{ receiver_id, envelope }`，不再套 A2A Message | 协议应独立于第三方格式 |
| 语义提取 LLM 调用删除 | `original_text` = 用户原始输入，不需要 LLM "提取语义" | Agent IS the LLM |
| Receiver 返回协议级响应 | `{ status: "ok" }` 而非 `successResponse()` | 协议定义的格式优先于框架约定 |
| Agent ID 格式 name@host | `agent-zh-CN@localhost` 而非 `agent-zh-CN-3001` | 与 sender_id 规范一致 |
| Agent Card 版本保持 0.2 | agent_card.chorus_version("0.2") 独立于 envelope("0.4") | 两个版本号含义不同（文档已注明） |
| A2A 类型保留未删 | `A2AMessageSchema` 等保留在 types.ts 不使用 | 向后兼容，未来可清理 |

---

## 必读文件

1. `skill/PROTOCOL.md` — L1 协议规范 v0.4（71 行），所有实现的权威定义
2. `skill/TRANSPORT.md` — L3 默认传输 HTTP 绑定（298 行），参考实现的契约来源
3. `src/shared/types.ts` — Envelope v0.4 Zod schema，基础类型定义
4. `src/server/routes.ts` — 路由服务器 v0.4 实现
5. `memory-bank/architecture.md` — 架构决策全记录（含 Phase 6 变更表）
6. `pipeline/monitor.md` — 全局状态看板

---

## 风险与禁区

- **禁止**: 恢复 `original_semantic` 字段或语义提取 LLM 调用 — 原因：v0.4 明确定义 `original_text` 是原始文本
- **禁止**: 在传输路径重新引入 A2A 包装 — 原因：已验证裸 envelope 更简单可靠
- **注意**: `demo/index.ts` 中 agent ID 仍用硬编码 `agent-zh-cn` / `agent-ja`（无 @host） — demo 层未改，启动时会注册这些 ID，与默认格式不一致但不影响功能
- **注意**: Playwright E2E 测试可能因 API 格式变化需要更新 — demo 层调用 agent SDK 发消息，底层 API 已变
- **注意**: `spec/` 目录下的 JSON Schema 文件仍是 v0.3 — 权威 schema 已移至 `skill/envelope.schema.json`(v0.4)，spec/ 可清理
