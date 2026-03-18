<!-- Author: Lead -->

# 实施计划与并发检查单 (Execution Plan)

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明，无额外 Phase 闸门约束。

## [Phase 1] 基础模块（无依赖，四路并行）

- [ ] T-01 `[Assignee: be-domain-modeler]`: 创建 Zod Schema (`src/schemas/envelope.ts`, `src/schemas/agent-card.ts`) + 导出 JSON Schema (`spec/*.schema.json`) + 单元测试 (Blocker: None)
- [ ] T-04 `[Assignee: be-ai-integrator]`: 实现 `src/agent.ts` — LLM 语义提取 + 文化适配输出，提示词模板内联（来源 INTERFACE.md） (Blocker: None)
- [ ] T-05 `[Assignee: be-ai-integrator]`: 实现 `src/judge.ts` — LLM-as-Judge 盲评 + 三维度打分 + 一致性验证，评分量表内联（来源 INTERFACE.md） (Blocker: None)
- [ ] T-06 `[Assignee: be-ai-integrator]`: 创建 `data/test-corpus.json` — 200 条测试语料（100 文化禁忌 + 100 俚语），格式按 Data_Models.md TestCase (Blocker: None)

## [Phase 2] 信封逻辑（依赖 Schema）

- [ ] T-03 `[Assignee: be-domain-modeler]`: 实现 `src/envelope.ts` — 信封创建/验证/解析（createEnvelope, parseEnvelope, validateEnvelope） (Blocker: T-01)

## [Phase 3] 验证运行器（汇聚）

- [ ] T-07 `[Assignee: be-domain-modeler]`: 实现 `src/runner.ts` — chorus-validate CLI，三组对比运行 + Judge 评分 + 输出 report.json (Blocker: T-03, T-04, T-05, T-06)

## [Phase 4] 运行实验

- [ ] T-08 `[Assignee: be-ai-integrator]`: 运行完整 200 条实验，生成 `results/report.json` + `results/summary.md`，验证 A-05/A-08 假设 (Blocker: T-07)
