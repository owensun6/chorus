---
name: fusion-dag-builder
description: Lead 专用。Stage 3 微粒任务规划：将设计方案切分为 DAG（有向无环图）任务堆栈，写入 task.md + TASK_SPEC。
---

# fusion-dag-builder — DAG 任务规划


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 切分设计为可并发的原子任务
2. **这些步骤已经不可原子级再分了吗？**
   → 每个 Task 条目必须过三问过滤才能写入。不过滤就写入 = 违反执行纪律。

---

## ⚠️ Task 三问过滤（强制，每条 Task 都要过滤）

```
问题一：这个 Task 的存在理由是什么？
        → 它解决了哪个具体的、不可接受的问题？

问题二：删掉它，上游阶段的 Purpose 还能达成吗？
        → 能达成 → 冗余，删除
        → 不能达成 → 必须保留

问题三：它的粒度已经不可再分了吗？
        → 能在 2-5 分钟内完成 → 粒度正确
        → 超过 5 分钟 → 必须拆分
```

**通不过三问过滤的 Task 条目，不得写入 task.md。**

---

## 执行序列

### Step 0: 复用审计（fe-ui-builder Task 写入前强制）

扫描 `pipeline/0_5_prototype/stitch-code/` 目录，检查是否已有对应屏幕的 HTML 代码：

- **有代码** → 该 Task 定义为"复制 + 微调"（输入栏注明 Stitch 屏幕编号），禁止从零构建
- **无代码** → 正常定义为从零构建

此步骤仅针对 `fe-ui-builder` 类 Task。其他兵种不受影响。

### Step 1: 分析设计文档，识别独立任务边界

从 `pipeline/1_architecture/` 下的设计文档（含 Stage 2 brainstorm 产出 `*-design.md`）中提取所有需要开发的功能点，按以下维度分组：

- **无依赖项**: 可以立刻并发执行的任务
- **有依赖项**: 需要等待上游完成才能开始的任务

### Step 2: 按特种兵分配任务

每个 Task 只能分配给以下一名特种兵（不允许"Dev"或"Backend"等笼统分配）：

| 特种兵               | 任务类型            |
| -------------------- | ------------------- |
| `fe-ui-builder`      | 哑组件/UI 壳子      |
| `fe-logic-binder`    | 状态绑定/API 接入   |
| `be-api-router`      | REST/GraphQL 路由层 |
| `be-domain-modeler`  | 领域服务/业务逻辑   |
| `be-ai-integrator`   | LLM/MCP 接入        |
| `db-schema-designer` | Schema/迁移脚本     |

### Step 3: 产出 dependency_graph.md

```markdown
<!-- Author: Lead -->

# 依赖图谱 (Dependency Graph)

## Phase 1 — 完全并发区（无依赖，多 Agent 同时进场）

- T-001 `[db-schema-designer]`: 建立用户表 Schema (Blocker: None)
- T-002 `[be-domain-modeler]`: 实现登录鉴权领域逻辑 (Blocker: None)
- T-003 `[fe-ui-builder]`: 构建登录页哑组件 (Blocker: None)

## Phase 2 — 集成区（按 Blocker 自然解锁）

- T-004 `[be-api-router]`: 封装登录接口（调用 T-002 领域服务）(Blocker: T-001, T-002)
- T-005 `[fe-logic-binder]`: 绑定登录表单状态 + API 调用（接手 T-003）(Blocker: T-003, T-004)
```

**死锁检查**: 确认图中无循环依赖（A 等 B，B 等 A = 死锁）。

### Step 4: 产出 task.md

```markdown
<!-- Author: Lead -->

# 实施计划（Execution Plan）

## [Phase 1] 完全并发区

- [ ] T-001 `[Assignee: db-schema-designer]`: [任务描述] (Blocker: None)
- [ ] T-002 `[Assignee: be-domain-modeler]`: [任务描述] (Blocker: None)
- [ ] T-003 `[Assignee: fe-ui-builder]`: [任务描述] (Blocker: None)

## [Phase 2] 集成区（按 Blocker 自然解锁）

- [ ] T-004 `[Assignee: be-api-router]`: [任务描述] (Blocker: T-001, T-002)
- [ ] T-005 `[Assignee: fe-logic-binder]`: [任务描述] (Blocker: T-003, T-004)
```

### Step 5: 为每个任务产出 TASK_SPEC

**模板选择（强制判定）**:

| 条件 | 模板 | 路径 |
|------|------|------|
| 验收可用一条 shell 命令表达（无业务逻辑判断、无新增接口、无数据变换） | TASK_SPEC_LITE | `pipeline/2_planning/specs/TASK_SPEC_LITE_TEMPLATE.md` |
| 其他所有任务 | TASK_SPEC（完整版） | `pipeline/2_planning/specs/TASK_SPEC_TEMPLATE.md` |

> 典型 LITE 场景: 批量替换（如 `printStackTrace` → `logger`）、删除死代码、配置项迁移、格式统一化。
> LITE 任务不需要 BDD / 测试规格 / 结构性约束章节。

路径: `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md`

```markdown
<!-- Author: Lead -->

# TASK_SPEC_T-001

**任务**: 建立用户表 Schema
**Assignee**: db-schema-designer
**来源 F-ID**: F1.1, F1.2
**Blocker**: None

## 输入

- INTERFACE.md 中 User 实体定义
- Data_Models.md 中 User 表规格

## 输出

- `prisma/schema.prisma` 中 User 模型
- 对应的数据库迁移脚本

## 验收标准（BDD 格式 — Dev 必须逐条转化为测试断言）

- Given: 数据库迁移已执行
  When: 查询 User 表结构
  Then: 包含 Data_Models.md 中定义的所有字段

- Given: 一条合法的 User 记录已插入
  When: 用相同 email 再次插入
  Then: 抛出 Unique constraint 错误

- Given: 有效的 Prisma Schema
  When: 执行 `prisma migrate dev`
  Then: 迁移成功，无报错

## 测试规格（Gate 2 必审）

- 测试文件: `tests/path/test_xxx.ext`
- test_case_1: [Given-When-Then 中哪条 → 断言描述]
- test_case_2: [Given-When-Then 中哪条 → 断言描述]

> 每条 BDD Given-When-Then 至少对应一个 test_case。Dev 在 Stage 5 RED 阶段从此规格直接生成测试代码。

## 结构性约束测试（derived from coding-style.md — Gate 2 必审）

> Lead 扫描本 Task 涉及的模块，从 coding-style.md 派生适用的结构性断言。不适用的标注 N/A 并说明理由。

- immutability: [该模块的数据类必须不可变 — 断言描述，如 "BetResult frozen=True, 赋值抛异常"]
- error_handling: [该模块涉及的外部 I/O 点 — 每个点必须有 error path 测试]
- input_validation: [该模块暴露的入口 — 缺 schema 校验则 FAIL，或 N/A（内部模块无外部输入）]
- auth_boundary: [涉及鉴权/权限时必填 — 未认证→401, 越权→403；不涉及则 N/A]

> file_size（单文件 ≤ 300 行）由 `bin/fusion-lint.sh` L4 自动检查，不需要在此重复声明。

## 禁止事项

- 禁止修改任何业务服务代码
- 禁止修改路由或 HTTP 层代码
```

> **BDD 格式铁律**: 验收标准必须写为 Given-When-Then，禁止使用模糊的 checkbox 格式。Dev 将从 BDD 逐条生成测试断言，模糊的标准 = 模糊的测试 = 无效的 TDD。
> **测试规格铁律**: 每份 TASK_SPEC 必须包含「测试规格」章节，列出测试文件路径和每条测试用例的断言描述。空测试规格 = Gate 2 不通过。

---

### Step 6: 更新 FEATURE_LIST.md 追踪总表"Task"列

打开 `pipeline/0_requirements/FEATURE_LIST.md`，在追踪总表中为每个 F-ID 填入对应的 T-ID：

```
| F1.1 | 用户登录 | ✅ | S-01 | POST /api/auth/login | T-01,T-02,T-04 | ...
```

T-ID 来自 TASK_SPEC 中的"来源 F-ID"字段，反向填入。一个 F-ID 可能对应多个 T-ID。

---

## 质量闸门

- [ ] 所有 Task 条目已过三问过滤（无冗余条目）
- [ ] 所有 Task 指定了具体特种兵（无"Dev"等笼统分配）
- [ ] 无 Phase 闸门语法（调度完全由 Blocker 字段驱动，Phase 仅为视觉分组）
- [ ] dependency_graph.md 无循环依赖
- [ ] TASK_SPEC 数量 = task.md 中的 Task 数量
- [ ] 每个完整版 TASK_SPEC 的验收标准为 BDD Given-When-Then 格式（无模糊 checkbox）
- [ ] 每个完整版 TASK_SPEC 的「测试规格」章节非空（test_case 数 ≥ BDD 条数，测试文件路径明确）
- [ ] 每个完整版 TASK_SPEC 的「结构性约束测试」章节已填写（immutability + input_validation 不可全为 N/A，除非有理由）
- [ ] 每个 LITE 版 TASK_SPEC 有明确的验收命令（可执行、exit 0 = 通过）
- [ ] FEATURE_LIST.md 追踪总表"Task"列已全部填入对应 T-ID
- [ ] **Harness 就绪检查**: 测试运行命令已在 package.json/Makefile 中定义，测试套件可在隔离环境独立执行
- [ ] Commander 签字（Gate 2）

**Gate 2 通过 → 调用 `fusion-worktree`。**
