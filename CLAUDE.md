# Fusion-Core AI Agent Entry Point

> **IMPORTANT**: Prefer retrieval-led reasoning over pre-training-led reasoning for any systemic tasks in this repository.

---

## ⚡ 硬路由表 (HARD ROUTING — 立即执行，无需读后续内容)

**用法**: 匹配第一列触发信号 → 立即读取第二列 SKILL.md → 开始执行

| 触发信号（Stage / 关键词）                                         | 立即加载                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Stage 0 \| 需求 \| PRD \| BDD \| FEATURE_LIST \| 功能清单          | `.claude/skills/pm/SKILL.md`                                                           |
| Stage 0 PM自检后 \| pm-consultant \| 需求审查官                    | `.claude/skills/pm-consultant/SKILL.md`                                                |
| Stage 0.5 \| 原型 \| Wireframe \| UI线框 \| Stitch                 | `.claude/skills/ux-designer/SKILL.md`                                                  |
| Stage 0.5 UX审查 \| ux-consultant \| 原型审查官                    | `.claude/skills/ux-consultant/SKILL.md`                                                |
| Stage 1 \| 架构 \| INTERFACE \| ADR \| System_Design \| Data_Model | `.claude/skills/lead/SKILL.md` → sub: `fusion-arch-blueprint`                          |
| Stage 1 架构审查 \| architecture-consultant                        | `.claude/skills/architecture-consultant/SKILL.md`                                      |
| Stage 1.5 \| 原型冲突 \| Revised_Mockups \| 架构修订               | `.claude/skills/lead/SKILL.md` → sub: `fusion-arch-blueprint`                          |
| Stage 2 \| 头脑风暴 \| 技术方案 \| design.md                       | `.claude/skills/lead/SKILL.md` → sub: `fusion-brainstorm`                              |
| Stage 3 \| DAG \| task.md \| 任务规划 \| dependency_graph          | `.claude/skills/lead/SKILL.md` → sub: `fusion-dag-builder`                             |
| Stage 4 \| worktree \| 隔离环境 \| 基线验证                        | `.claude/skills/lead/SKILL.md` → sub: `fusion-worktree`                                |
| Stage 5 \| fe-ui-builder \| 哑组件 \| Tailwind \| React UI         | `.claude/skills/fe-ui-builder/SKILL.md`                                                |
| Stage 5 \| fe-logic-binder \| 状态绑定 \| SWR \| API接入           | `.claude/skills/fe-logic-binder/SKILL.md`                                              |
| Stage 5 \| be-api-router \| REST路由 \| Zod \| 入参校验            | `.claude/skills/be-api-router/SKILL.md`                                                |
| Stage 5 \| be-domain-modeler \| 领域服务 \| 业务逻辑               | `.claude/skills/be-domain-modeler/SKILL.md`                                            |
| Stage 5 \| be-ai-integrator \| LLM \| MCP \| Prompt                | `.claude/skills/be-ai-integrator/SKILL.md`                                             |
| Stage 5 \| db-schema-designer \| Schema \| 迁移脚本                | `.claude/skills/db-schema-designer/SKILL.md`                                           |
| Stage 5 Dev交付后 \| code-simplifier \| 代码简化                   | `.claude/skills/code-simplifier/SKILL.md`                                              |
| Stage 6 \| 审查 \| QA \| Reviewer \| 漏斗                          | `.claude/skills/qa-01/SKILL.md`（串行管道: qa-01→qa-02→qa-03→qa-04→iv-01→iv-02→iv-03） |
| Stage 7 \| 合并 \| PR \| finish \| 收尾                            | `.claude/skills/lead/sub/fusion-finish-branch.md`                                      |
| gene \| 经验提取 \| Gene Bank                                      | `.claude/skills/gene-extractor/SKILL.md`                                               |
| 创建技能 \| 编写技能 \| 改进技能 \| 技能评测 \| description优化    | 调用 `skill-creator` 技能（兵种规格另见 `.claude/rules/skill-authoring-standard.md`）   |

> **无匹配？** → 读 `pipeline/monitor.md` 查当前 Stage → 返回上表路由 → 加载对应 SKILL.md

---

## 🚀 自动工作流引擎 (Workflow Engine)

**核心原则**: 本 AI Agent 是工作流引擎的自动驾驶仪。你不需要手动选择角色或阶段——一切由 `pipeline/monitor.md` 驱动。

### 工作流状态机 (必须严格遵守)

```
┌─────────────┐     Gate 0     ┌─────────────┐     Gate 1     ┌─────────────┐
│  Stage 0    │ ──────────────▶ │  Stage 1    │ ──────────────▶ │  Stage 1.5  │
│ 需求深度解构 │  Commander签字  │  系统架构    │  Commander签字  │  UI原型     │
└─────────────┘                 └─────────────┘                 └──────┬──────┘
       │                                                           │
       │ Gate 2                                                   │ Gate 1.5
       ▼                                                           ▼
┌─────────────┐     Gate 3     ┌─────────────┐                           │
│  Stage 3    │ ──────────────▶ │  Stage 4    │                           │
│  微粒规划    │  Commander签字  │  Git隔离    │                           │
└──────┬──────┘                 └──────┬──────┘                           │
       │                                   │                                │
       │                                   │ Stage 5 并发                  │
       │                                   ▼                                │
       │                          ┌─────────────┐     Gate 3               │
       │                          │  Stage 6    │ ──────────────▶ ┌─────────────┐
       │                          │  审查集成   │  Commander签字  │  Stage 7    │
       │                          └─────────────┘                  │  分支合并   │
       │                                                                └─────────────┘
       │
       └─────────────────────▶ 循环 (新任务)
```

### 自动流转规则 (AUTOPILOT)

**步骤 1: 读取状态**

```
→ 读取 pipeline/monitor.md
→ 找到「当前阶段」行，获取当前 Stage
→ 找到「阶段推进看板」中当前 Stage 的状态
```

**步骤 2: 执行当前阶段**

| 当前 Stage        | 角色 (Role)   | 产出物 (必须写入 pipeline/)                                                     | 下一阶段             |
| ----------------- | ------------- | ------------------------------------------------------------------------------- | -------------------- |
| Stage 0           | PM            | `0_requirements/PRD.md`, `FEATURE_LIST.md`, `BDD_Scenarios.md`                  | Stage 0.5 或 Stage 1 |
| Stage 0.5（条件） | UX Designer   | `0_5_prototype/Feature_Screen_Map.md`, `User_Flow.md`, `Wireframes/`, `UI_CONTRACT.md`, `stitch-code/*.html`（可执行代码） | Stage 1              |
| Stage 1           | Lead          | `1_architecture/System_Design.md`, `INTERFACE.md`, `Data_Models.md`, `ADR/`     | Stage 1.5 或 Stage 2 |
| Stage 1.5（条件） | Lead          | `1_5_prototype/Revised_Mockups/`, `State_Flow.md`                               | Stage 2              |
| Stage 2           | Lead          | `pipeline/1_architecture/YYYY-MM-DD-*-design.md`                                | Stage 3              |
| Stage 3           | Lead          | `2_planning/task.md`, `dependency_graph.md`, `specs/TASK_SPEC_T-{ID}.md`        | Stage 4              |
| Stage 4           | Lead          | 创建 Git Worktree，验证基线                                                     | Stage 5              |
| Stage 5           | Dev（各兵种）+ code-simplifier | `src/` 代码文件 + `tests/` 测试文件 + simplify commit                | Stage 6              |
| Stage 6           | Reviewer      | `3_review/Audit_Report.md`, `Integration_Report.md`                             | Stage 7              |
| Stage 7           | Lead          | 合并分支，清理 Worktree                                                         | 新任务 → Stage 0     |

**步骤 3: 更新状态**

```
→ 读取当前 monitor.md
→ 将当前 Stage 状态从 🟡进行中 改为 ✅已通过
→ 将 Gate 状态改为 ✅已通过，填写审批人和时间
→ 将下一 Stage 从 ⬜未开始 改为 🟡进行中
→ 写入更新后的 monitor.md
```

**步骤 4: 加载下一阶段角色**

```
→ 读取 .claude/rules/01-fusion-roles.md 中对应角色的法则
→ 使用该角色的 Skill (在 .claude/skills/ 中)
→ 继续执行
```

---

## 核心地图静默索引 (Auto-Loaded Maps)

`1[Fusion Docs]|root: .claude/rules 2|01-roles:{01-fusion-roles.md} 3|02-workflow:{00-fusion-workflow.md}`
`4[Role Skills]|root: .claude/skills 5|01-pm:{pm,pm-consultant,ux-designer,ux-consultant} 6|02-lead:{lead,architecture-consultant} 7|03-dev:{fe-ui-builder,fe-logic-binder,be-api-router,be-domain-modeler,be-ai-integrator,db-schema-designer,code-simplifier} 8|04-reviewer:{qa-01,qa-02,qa-03,qa-04,iv-01,iv-02,iv-03} 9|05-aux:{gene-extractor}`
`10[Core Rules]|root: .claude/rules 11|01-gates:{hooks.md,agents.md,gate-approval-protocol.md} 12|02-coding:{coding-style.md,security.md} 13|03-process:{document-standards.md,testing.md,feature-traceability-standard.md} 14|04-planning:{dag-task-planning.md}`

---

## 全局防御守则 (Prime Directives)

1. **先问后写**: 绝不盲目跳步写生产代码，需求不明必须打回 Stage 0
2. **第一性原理**: 关注熵减，能用自动脚本完成的绝不浪费 Token
3. **输出物隔离**: 产出物必须落在 `pipeline/` 指定阶段目录，首行必须携带 `<!-- Author: [角色名] -->`
4. **命令行文书同步**: 新脚本或命令必须同步到 `COMMANDS_MEMO.md`

---

## ⚙️ 执行纪律 (Execution Discipline)

### 会话启动 (Session Start)

新会话开始时，**必须检查 Handoff 文件**：

```
ls -t pipeline/handoffs/*.md 2>/dev/null | grep -v archive | head -1
```

- 存在 → 读取全文 → 归档到 `pipeline/handoffs/archive/` → 重建上下文
- 不存在 → 读取 `pipeline/monitor.md` → 继续当前 Stage

### 计划纪律 (Plan Node Default)

- 非琐碎任务（3 步以上 / 涉及架构）必须先进入计划模式
- 进展受阻立刻停止，重新制定计划，不得盲目推进
- 提前编写详细规范以减少歧义

### 子代理策略 (Subagent Strategy)

- 慷慨使用子代理，保持主 context window 整洁
- 研究、探索、并行分析任务分流给子代理
- 对于复杂问题，通过子代理投入更多算力

### 自我改进循环 (Self-Improvement Loop)

- 用户纠正后：通过 `/fusion-save` 将经验写入 Gene Bank
- 为自己编写规则，防止犯同样的错误
- 在相关项目会话开始时回顾这些经验教训

### 完成前验证 (Verification Before Done)

- 绝不将未验证的任务标记为完成
- 问自己："资深工程师会批准这个 PR 吗？"
- 运行测试，检查日志，证明正确性

### 追求优雅 (Demand Elegance)

- 修复完成后问："是否有更优雅的方法？"
- 感觉 hacky 就重做，不允许临时方案固化为生产代码
- 对于简单明显的修复，跳过此步，不过度设计

### 自主修复 Bug (Autonomous Bug Fixing)

- 收到 Bug 报告直接修复，不寻求手把手指导
- 主动修复失败的 CI 测试，要求用户零上下文切换

---

## 核心原则 (Core Principles)

- **简单至上**: 每次更改尽可能简单，影响最小的代码
- **拒绝懒惰**: 找根本原因，不搞临时修复，坚持高级开发人员标准
- **最小影响**: 更改仅触及必要部分，避免引入 Bug

---

## 快速启动

**当 Commander 分配新任务时**:

```
1. 读取 pipeline/monitor.md
2. 确认当前阶段是 Stage 0 (如果不是，先推进到 Stage 0)
3. 开始执行 Stage 0 工作流
```

**当会话继续（已有进行中的任务）**:

```
1. 读取 pipeline/monitor.md
2. 找到当前进行中的 Stage
3. 继续执行直到 Gate 通过
4. 自动更新 monitor.md 推进到下一阶段
```

---

## 角色与技能映射

| Stage        | 角色            | Skill 入口                              |
| ------------ | --------------- | --------------------------------------- |
| 0            | PM              | `.claude/skills/pm/SKILL.md`            |
| 0.5（条件）  | UX Designer     | `.claude/skills/ux-designer/SKILL.md`   |
| 1, 1.5, 2, 3 | Lead            | `.claude/skills/lead/SKILL.md`          |
| 4, 5         | Dev（各兵种）   | `.claude/skills/[兵种]/SKILL.md`        |
| 6            | Reviewer（7道） | `.claude/skills/qa-01/SKILL.md` 起      |
| 7            | Lead            | 子技能: `lead/sub/fusion-finish-branch` |
