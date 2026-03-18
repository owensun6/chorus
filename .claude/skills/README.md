# Fusion 技能清单 (Skill Catalog)

> **版本**: Fusion Method v0.1（融合后统一版本）
> **融合来源**: Superpowers + CC-Best + ECC + BMAD → Fusion
> **更新日期**: 2026-03-03
>
> 本文档是所有可用技能的 Only Source of Truth。

---

## 一、内建角色技能（Fusion-Core Skills）

### 需求与审查组（Stage 0）

| 角色代号        | 职责                                   | SKILL.md                                         |
| --------------- | -------------------------------------- | ------------------------------------------------ |
| `pm`            | 需求深度解构，PRD + FEATURE_LIST + BDD | [pm/SKILL.md](pm/SKILL.md)                       |
| `pm-consultant` | 批判对手视角审查 PM 产出物             | [pm-consultant/SKILL.md](pm-consultant/SKILL.md) |

### UX 原型组（Stage 0.5）

| 角色代号        | 职责                              | SKILL.md                                         |
| --------------- | --------------------------------- | ------------------------------------------------ |
| `ux-designer`   | 低保真原型，Stitch MCP 必须出初稿 | [ux-designer/SKILL.md](ux-designer/SKILL.md)     |
| `ux-consultant` | 批判对手视角审查原型              | [ux-consultant/SKILL.md](ux-consultant/SKILL.md) |

### 架构与规划组（Stage 1-3）

| 角色代号                  | 职责                               | SKILL.md                                                             |
| ------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `lead`                    | 系统架构 + INTERFACE.md + DAG 规划 | [lead/SKILL.md](lead/SKILL.md)                                       |
| `architecture-consultant` | 批判对手视角审查架构产出           | [architecture-consultant/SKILL.md](architecture-consultant/SKILL.md) |

### 前端开发组（Stage 5）

| 角色代号          | 职责                       | SKILL.md                                             |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| `fe-ui-builder`   | 哑组件构建（只有壳没有魂） | [fe-ui-builder/SKILL.md](fe-ui-builder/SKILL.md)     |
| `fe-logic-binder` | 状态绑定、API 接入         | [fe-logic-binder/SKILL.md](fe-logic-binder/SKILL.md) |

### 后端开发组（Stage 5）

| 角色代号             | 职责                             | SKILL.md                                                   |
| -------------------- | -------------------------------- | ---------------------------------------------------------- |
| `be-api-router`      | REST/GraphQL 路由 + Zod/Joi 验证 | [be-api-router/SKILL.md](be-api-router/SKILL.md)           |
| `be-domain-modeler`  | 领域服务 + 业务逻辑核心          | [be-domain-modeler/SKILL.md](be-domain-modeler/SKILL.md)   |
| `be-ai-integrator`   | LLM/MCP 子系统接入               | [be-ai-integrator/SKILL.md](be-ai-integrator/SKILL.md)     |
| `db-schema-designer` | 数据库 Schema + 迁移脚本         | [db-schema-designer/SKILL.md](db-schema-designer/SKILL.md) |

### 代码简化（Stage 5 Dev 交付后）

| 角色代号          | 职责                                                           | SKILL.md                                               |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `code-simplifier` | 代码简化，提升可读性/一致性/可维护性（调用 CC 官方 agent） | [code-simplifier/SKILL.md](code-simplifier/SKILL.md) |

### 质量审计组（Stage 6）— 串行管道

```
qa-01 → qa-02 → qa-03 → qa-04 → iv-01 → iv-02 → iv-03
前一道 FAIL，后续道次不得启动
```

| 角色代号 | 职责                                                             | SKILL.md                         |
| -------- | ---------------------------------------------------------------- | -------------------------------- |
| `qa-01`  | **功能逻辑审查**：单元测试、分支覆盖率、空指针/死循环/业务 BUG   | [qa-01/SKILL.md](qa-01/SKILL.md) |
| `qa-02`  | **性能 + UI/UX 批判**：N+1查询、过量重绘、UI_CONTRACT 一致性     | [qa-02/SKILL.md](qa-02/SKILL.md) |
| `qa-03`  | **安全零信任审计**：IDOR、SQL 注入、CSRF/XSS、Token 过期         | [qa-03/SKILL.md](qa-03/SKILL.md) |
| `qa-04`  | **领域法务验证**：业务不变量、医疗规范合规、PRD 验收对齐         | [qa-04/SKILL.md](qa-04/SKILL.md) |
| `iv-01`  | **E2E 连通性验证**：Playwright 端到端旅程，HTTP 状态码全绿       | [iv-01/SKILL.md](iv-01/SKILL.md) |
| `iv-02`  | **数据穿透 + ACID 验证**：序列化完整性、并发写入保护、事务原子性 | [iv-02/SKILL.md](iv-02/SKILL.md) |
| `iv-03`  | **混沌极限破坏测试**：边界值注入、超时降级、极限负载、重复提交   | [iv-03/SKILL.md](iv-03/SKILL.md) |

### 辅助角色

| 角色代号         | 职责                                            | SKILL.md                                           |
| ---------------- | ----------------------------------------------- | -------------------------------------------------- |
| `gene-extractor` | 跨项目经验提取写入 Gene Bank（每 2-3 轮可触发） | [gene-extractor/SKILL.md](gene-extractor/SKILL.md) |

---

## 二、外部技能（Superpowers Plugin）

这些技能来自 Superpowers 插件，在 Fusion 中直接引用，无需重写。

| 技能名                  | 用途                            | 在 Fusion 中的阶段 |
| ----------------------- | ------------------------------- | ------------------ |
| `brainstorming`         | 探索 2-3 种实现路径 + 权衡分析  | Stage 2（备选）    |
| `using-git-worktrees`   | 物理隔离开发环境 + 基线验证     | Stage 4（备选）    |
| `fusion-tdd`            | TDD Red-Green-Refactor 完整流程 | Stage 5            |
| `receiving-code-review` | 接收审查意见时的技术严谨性纪律  | Stage 6            |

> **Stage 2 主路径**: `lead/sub/fusion-brainstorm.md`（内置，优先使用）
> **Stage 4 主路径**: `lead/sub/fusion-worktree.md`（内置，优先使用）
> **Stage 7 主路径**: `lead/sub/fusion-finish-branch.md`（内置，已替代外部 `finishing-a-development-branch`）

**⚠️ 废弃通知**:

| 废弃技能                         | 替代                            | 原因                                        |
| -------------------------------- | ------------------------------- | ------------------------------------------- |
| `dispatching-parallel-agents`    | `fusion-swarm`                  | fusion-swarm 是更完整的 Fusion 并行调度方案 |
| `finishing-a-development-branch` | `lead/sub/fusion-finish-branch` | Stage 7 已内置，路径更明确，与 Fusion 一致  |

---

## 三、技能总览（角色数量统计）

| 类别                  | 角色数 |
| --------------------- | ------ |
| 需求与审查组          | 2      |
| UX 原型组             | 2      |
| 架构与规划组          | 2      |
| 前端开发组            | 2      |
| 后端开发组            | 4      |
| 代码简化              | 1      |
| 质量审计组（QA + IV） | 7      |
| 辅助角色              | 1      |
| **合计**              | **21** |

Commander（人类）不计入 AI 角色体系。

---

## 四、共享规则（Auto-Loaded）

以下规则由 CLAUDE.md 自动加载，无需在技能中重复引用。

| 资源           | 位置                                         | 说明                         |
| -------------- | -------------------------------------------- | ---------------------------- |
| 工作流规范     | `.claude/rules/00-fusion-workflow.md`        | 8 阶段管道 + Gate 协议       |
| 角色定义       | `.claude/rules/01-fusion-roles.md`           | 20 角色职责与禁区            |
| 代码规范       | `.claude/rules/coding-style.md`              | 不变性 + 文件大小 + 错误处理 |
| 安全红线       | `.claude/rules/security.md`                  | OWASP Top 8 检查             |
| DAG 规划       | `.claude/rules/dag-task-planning.md`         | task.md 三问过滤 + 模板      |
| 功能追踪矩阵   | `.claude/rules/feature-traceability-standard.md` | FEATURE_LIST 全生命周期追踪  |

> **`skills_reference/`** 是融合前的原材料归档目录（旧结构 `01_role_pm/`, `02_role_lead/` 等），
> 融合已完成，生产环境请使用 `.claude/skills/` 下的新技能，不依赖 skills_reference。
