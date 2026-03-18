<!-- Author: Lead -->

# TASK_SPEC T-01: 协议 Schema 定义

**Assignee**: be-domain-modeler
**Blocker**: None
**F-ID**: F1, F2

## 目标

创建 Chorus 协议的 Zod Schema + JSON Schema 导出。

## 交付物

- `spec/chorus-envelope.schema.json` — 信封 JSON Schema
- `spec/chorus-agent-card.schema.json` — Agent Card 扩展 JSON Schema
- `src/schemas/envelope.ts` — Zod 定义（运行时校验用）
- `src/schemas/agent-card.ts` — Zod 定义
- `tests/schemas/envelope.test.ts` — 信封 Schema 单元测试
- `tests/schemas/agent-card.test.ts` — Agent Card Schema 单元测试

## 验收命令

```bash
npx jest tests/schemas/ --coverage
# exit 0 = 通过，覆盖率 ≥ 80%
```

## 约束

- 字段定义严格按 INTERFACE.md
- BCP47 标签用 regex 校验
- 必填字段缺失时 → Zod parse 抛出明确错误
- 可选字段缺失时 → 默认值为 undefined，不填充默认
