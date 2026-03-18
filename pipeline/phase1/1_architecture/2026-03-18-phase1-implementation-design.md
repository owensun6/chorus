<!-- Author: Lead -->

# Phase 1 实现方案技术设计

**日期**: 2026-03-18
**关联 F-ID**: F1v2, F2v2, F3v2, F5, F6, F7（全部）

---

## 背景与约束

| 约束源 | 约束内容 |
|--------|---------|
| ADR-P1-001 | raw HTTP + A2A 兼容 JSON，不依赖 A2A SDK |
| INTERFACE.md | 5 HTTP 端点 + 1 Agent 端点 + CLI 命令 |
| PRD NFR | 单跳 < 5s, 2 Agent 并发, 内存存储 |
| Coding Style | Zod 校验, 不可变性, 单文件 ≤ 300 行, 单函数 ≤ 40 行 |
| Testing | TDD, 80% 覆盖率 |
| Phase 0 遗产 | `spec/*.schema.json` 需升级为 v0.2；`src/` 和 `spike/` 代码废弃不复用 |

**核心设计问题**: 代码如何组织，才能让 3-4 名 Dev 兵种并行编码、独立测试、最终拼接？

---

## 方案对比

### 路径 1: Minimal Flat（最少文件，最快交付）

**核心思路**: 每个交付物用尽可能少的文件实现，不做模块拆分。

**结构**:
```
src/
├── server.ts          # 路由服务器全部逻辑（~250行）
├── agent.ts           # Agent 全部逻辑（~300行）
├── types.ts           # 共享类型 + Zod Schema
spec/
├── chorus-envelope.schema.json (v0.2)
├── chorus-agent-card.schema.json (v0.2)
├── chorus-prompt-template.md (v0.2)
tests/
├── server.test.ts
├── agent.test.ts
```

**实现要点**:
- `server.ts`: 内联 registry Map + 路由处理 + Zod 校验，单文件 Express/Hono app
- `agent.ts`: 内联 LLM 调用 + 信封构造 + HTTP server + readline 循环
- 共享类型通过 `types.ts` 一个文件搞定

**风险**:
- `agent.ts` 大概率超 300 行限制（LLM + 信封 + HTTP + CLI 四件事）
- 无法有效并行——2 名 Dev 同时改 `agent.ts` 会冲突
- TDD 难度高——无法单独测试信封创建或 LLM 调用

---

### 路径 2: Modular Layered（模块化，对齐 System_Design 目录结构）

**核心思路**: 按职责拆分模块，每个模块一个文件，严格遵守 300 行限制。模块边界 = Dev 兵种分工边界。

**结构**:
```
src/
├── server/
│   ├── index.ts        # 入口：创建 HTTP server + 挂载路由
│   ├── registry.ts     # AgentRegistry class（内存 Map 操作）
│   ├── routes.ts       # HTTP 路由定义（调用 registry）
│   └── validation.ts   # Zod Schema（请求体校验）
├── agent/
│   ├── index.ts        # 入口：CLI 参数解析 + 启动流程编排
│   ├── envelope.ts     # Chorus 信封创建/解析/校验
│   ├── llm.ts          # Dashscope LLM 客户端（语义提取 + 文化适配）
│   ├── receiver.ts     # HTTP Server（接收转发消息）
│   └── discovery.ts    # Agent 发现 + 兼容性检查
├── shared/
│   └── types.ts        # 共享 TypeScript 类型 + Zod Schema
spec/
│   ├── chorus-envelope.schema.json (v0.2)
│   ├── chorus-agent-card.schema.json (v0.2)
│   └── chorus-prompt-template.md (v0.2)
tests/
├── server/
│   ├── registry.test.ts
│   ├── routes.test.ts
│   └── validation.test.ts
├── agent/
│   ├── envelope.test.ts
│   ├── llm.test.ts
│   ├── receiver.test.ts
│   └── discovery.test.ts
└── e2e/
    └── conversation.test.ts
```

**实现要点**:
- 每个模块 100-200 行，远低于 300 行限制
- `envelope.ts` 纯函数（创建/解析/校验），无 I/O，最容易测试
- `llm.ts` 封装 Dashscope 调用，测试时 mock HTTP 即可
- `registry.ts` 纯内存操作，无外部依赖
- `routes.ts` 薄层胶水，调用 registry + validation
- Dev 兵种分工清晰：be-api-router → routes.ts + validation.ts; be-domain-modeler → envelope.ts + registry.ts; be-ai-integrator → llm.ts

**风险**:
- 文件数量较多（~12 个 src + ~8 个 test = ~20 文件）
- 模块间依赖需要提前定义好接口（types.ts 是关键）

---

### 路径 3: Protocol SDK First（先建 SDK，再建应用）

**核心思路**: 将 Chorus Protocol 的核心逻辑（信封、Agent Card、校验、提示词）抽象为一个可复用的 SDK 包，Server 和 Agent 作为 SDK 的消费者。

**结构**:
```
packages/
├── chorus-protocol/     # SDK 包
│   ├── src/
│   │   ├── envelope.ts  # 信封创建/解析/校验
│   │   ├── agent-card.ts # Agent Card 创建/校验/匹配
│   │   ├── prompts.ts   # 提示词模板管理
│   │   ├── schemas.ts   # Zod Schema 定义
│   │   └── index.ts     # 公共 API 导出
│   ├── tests/
│   └── package.json
├── chorus-server/       # 路由服务器
│   ├── src/
│   └── package.json
├── chorus-agent/        # 参考 Agent
│   ├── src/
│   └── package.json
package.json             # workspace root
tsconfig.json
```

**实现要点**:
- `chorus-protocol` 包可被第三方 Agent 开发者直接安装使用
- Schema 定义集中在 SDK 中，Server 和 Agent 共享
- Phase 2 引入新 Agent 时直接 `npm install chorus-protocol`

**风险**:
- **过度设计**——Phase 1 只有 2 个 Agent，不存在"第三方消费者"
- monorepo workspace 增加构建复杂度（tsconfig references, npm workspaces）
- 开发时间显著增加（多包管理、版本、导出策略）
- FP 质疑：为不存在的消费者建 SDK = 为幻想写代码

---

## 权衡矩阵

| 维度 | 路径 1: Minimal Flat | 路径 2: Modular Layered | 路径 3: SDK First |
|------|---------------------|------------------------|-------------------|
| 实现复杂度 | 低 | 中 | 高 |
| 开发时间 | ~2h | ~3h | ~5h+ |
| TDD 友好度 | **差** — 大函数难以单元测试 | **好** — 每模块独立可测 | **好** — SDK 层高度可测 |
| 并行 Dev 兵种数 | 2（server + agent） | 3-4（routes/registry/envelope/llm 各自独立） | 3+（但需要先完成 SDK） |
| 300 行限制合规 | **风险** — agent.ts 可能超标 | **安全** — 每模块 100-200 行 | **安全** |
| Phase 2 迁移成本 | 高（重构才能拆分） | 低（模块已拆好，加 SDK 层即可） | 零（已是 SDK） |
| 技术风险 | 低 | 低 | 中（monorepo 构建） |
| 满足 Coding Style | **部分违反**（行数限制） | **完全满足** | **完全满足** |

---

## 推荐方案

**推荐**: 路径 2 — Modular Layered

**原因**:

1. **满足 TDD 强制要求** — 每个模块可独立写测试、独立跑红灯绿灯。路径 1 的大文件做 TDD 等于在 300 行函数里 mock 一切，痛苦且脆弱
2. **满足 300 行/40 行限制** — 路径 1 几乎必然违反 Coding Style 的行数限制
3. **并行 Dev 开发** — 3-4 名 Dev 兵种可以同时工作在不同文件，零 git 冲突
4. **Phase 2 迁移路径清晰** — 路径 2 的 `envelope.ts` + `agent-card.ts` + `types.ts` 可以直接提升为 SDK 包，无需重写
5. **FP 删除检验** — 路径 2 的每个文件都有明确的消费者（被其他模块 import 或被测试覆盖），没有死代码

**被拒方案**:
- 路径 1 因违反 Coding Style 行数限制 + TDD 不友好被放弃
- 路径 3 因"为不存在的消费者建 SDK"违反 FP 删除原则被放弃

---

## 补充设计决策

### LLM 集成方式

| 选项 | 说明 | 推荐？ |
|------|------|--------|
| A: `openai` npm 包 + Dashscope 兼容端点 | Dashscope 支持 OpenAI-compatible API。`baseURL` 指向 Dashscope，其余代码与 OpenAI 一致 | **✅ 推荐** — 零学习成本，LLM 无关性天然达成 |
| B: 直接 HTTP 调用 Dashscope 原生 API | 更多控制，Dashscope 特有功能 | 不推荐 — 增加代码量，锁死供应商 |

### HTTP 框架

| 选项 | 说明 | 推荐？ |
|------|------|--------|
| Express | 生态最大，文档最全 | 可选 — 但偏重 |
| Hono | 超轻量（~14KB），API 现代，支持 Node.js | **✅ 推荐** — 最简，内部 demo 不需要 Express 生态 |
| Node.js native http | 零依赖 | 不推荐 — 路由手写繁琐，不值得 |

### A2A JSON 保真度

| 选项 | 说明 | 推荐？ |
|------|------|--------|
| 完全 A2A 结构（role, parts[], extensions[]） | 与 INTERFACE.md 定义一致 | **✅ 推荐** — 已在 INTERFACE.md 中定义，Dev 按契约实现即可 |
| 简化 Chorus 格式 `{ text, envelope }` | 更简单，但需要 Phase 2 迁移时重写格式 | 不推荐 — 省的时间少于 Phase 2 迁移成本 |

---

## 下一步

Commander 确认后，调用 `fusion-dag-builder` 进行 Stage 3 任务规划。Task 分配将基于路径 2 的模块边界。
