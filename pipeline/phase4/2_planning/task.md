<!-- Author: Lead -->

# Phase 4 实施计划与并发检查单 (Execution Plan)

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明。

## [Phase 1] 完全并行

- [ ] T-01 `[Assignee: be-domain-modeler]`: 新建 `tsconfig.json`（outDir: dist, strict, ES2022），`package.json` 添加 `"build": "tsc"` 和 `"start": "node dist/server/index.js"` (Blocker: None)
- [ ] T-02 `[Assignee: be-api-router]`: 路由服务器生产模式 — 新建 `src/server/auth.ts`（Bearer token 中间件）+ 修改 `src/server/index.ts`（读 PORT/CHORUS_API_KEYS 环境变量，挂载 auth 包裹 routes，缺 key 拒绝启动） (Blocker: None)
- [ ] T-03 `[Assignee: be-api-router]`: `src/server/routes.ts` 新增 `GET /health` — 返回 `{ status: "ok", version, uptime_seconds }` (Blocker: None)
- [ ] T-04 `[Assignee: be-domain-modeler]`: Agent 侧鉴权 — `AgentConfig` 新增 `routerApiKey?: string`，`agent/index.ts` 所有 `fetch(routerUrl/...)` 的 POST/DELETE 请求附加 `Authorization: Bearer <key>` 头 (Blocker: None)

## [Phase 2] 容器化

- [ ] T-05 `[Assignee: be-domain-modeler]`: 新建 `Dockerfile` + `.dockerignore` — node:22-alpine, npm ci, tsc 编译, 生产跑编译后 JS (Blocker: T-01, T-02)
