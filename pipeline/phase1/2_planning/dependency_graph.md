<!-- Author: Lead -->

# 依赖图谱 (Dependency Graph) — Phase 1

```
T-01 (types+schemas) ─┬──> T-02 (envelope) ──────────┬──> T-07 (agent receiver) ──┐
                       ├──> T-03 (discovery)           │                            │
                       ├──> T-04 (llm client) ─────────┘                            ├──> T-08 (agent CLI)
                       └──> T-05 (server CRUD) ──> T-06 (server messages)           │
                                                                                    │
                            T-03 (discovery) ───────────────────────────────────────┘
```

## [Phase 1] 基础层（无依赖）

- T-01 `[be-domain-modeler]`: 共享类型 + Zod Schema + 协议规范 v0.2 (Blocker: None)

## [Phase 2] 核心模块（均仅依赖 T-01，4 路并发）

- T-02 `[be-domain-modeler]`: 信封创建/解析/校验模块 (Blocker: T-01)
- T-03 `[be-domain-modeler]`: Agent Card 校验 + 语言匹配 (Blocker: T-01)
- T-04 `[be-ai-integrator]`: LLM 客户端 + 提示词模板 (Blocker: T-01)
- T-05 `[be-api-router]`: 路由服务器 — Agent 注册/发现 CRUD (Blocker: T-01)

## [Phase 3] 集成层（按 Blocker 解锁）

- T-06 `[be-api-router]`: 路由服务器 — 消息转发 + 服务器入口 (Blocker: T-05)
- T-07 `[be-api-router]`: Agent 接收端 HTTP Server (Blocker: T-02, T-04)

## [Phase 4] 组装层

- T-08 `[be-domain-modeler]`: Agent CLI 入口 + 生命周期编排 (Blocker: T-02, T-03, T-04, T-07)

## 死锁检查

无循环依赖。最长路径: T-01 → T-02 → T-07 → T-08（4 步）。
