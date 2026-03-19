<!-- Author: Lead -->

# Phase 2 依赖图谱

```
T-01 (types v0.3 + history) → T-02 (envelope v0.3)  ──────────────→ T-06 (agent lifecycle) → T-08 (demo orchestrator)
                             → T-03 (LLM streaming) → T-04 (receiver streaming) → T-05 (router streaming) →↗
T-07 (Web UI HTML) ──────────────────────────────────────────────────────────────────────────────────────→↗
```

## 并发分析

| 阶段 | 并发数 | 任务 |
|------|--------|------|
| Phase 1 | 2 | T-01, T-07 |
| Phase 2 | 3 | T-02, T-03, T-04(等 T-03) |
| Phase 3 | 2 | T-05, T-06 |
| Phase 4 | 1 | T-08 |

最大并发: 3 路（Phase 2 阶段）

## 兵种分配

| 兵种 | Tasks | 文件范围 |
|------|-------|---------|
| be-domain-modeler | T-01, T-02, T-06 | types.ts, history.ts, envelope.ts, agent/index.ts |
| be-ai-integrator | T-03 | llm.ts |
| be-api-router | T-04, T-05, T-08 | receiver.ts, routes.ts, demo/*.ts |
| fe-ui-builder | T-07 | web/index.html |
