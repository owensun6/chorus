# 并行网络规划准则与任务清单模板 (DAG & task.md)

> **[!] CRITICAL**: 指挥官（Lead 架构师）在 Stage 3 切分任务时，必须基于图论思想（有向无环图）进行调度。禁止一条线从头跑到尾（那会浪费大模型的并发潜能）。

## 0. 任务拆解前置：第一性原理过滤

> **[!] CRITICAL**: Lead 在写下任何 Task 条目之前，必须先完成此过滤。跳过此步骤导致的任何粒度问题，责任在 Lead。

### 每个 Task 条目必须通过三问过滤

```
问题一：这个 Task 的存在理由是什么？
        → 它解决了哪个具体的、不可接受的问题？

问题二：删掉它，上游阶段的 Purpose 还能达成吗？
        → 能达成 → 冗余，删除
        → 不能达成 → 必须保留

问题三：它的粒度已经不可再分了吗？
        → 能在 2-5 分钟内完成 → 粒度正确
        → 超过 5 分钟 → 必须拆分，直到每个子任务满足条件
```

通不过三问过滤的 Task 条目，**不得写入 task.md**。

---

## 1. 任务切割粒度 (Task Granularity)

- **原子化（不可再分）**: 每个子任务（Task）的生命周期必须控制在 **2 到 5 分钟** 的对话流内能够完成。
- **独立性**: 尽量确保不同兵种的 Task 涉及的文件物理路径是绝对隔离的（你改 Backend Controller，我改 Frontend Button），以适应大规模克隆并发。

## 2. DAG 依赖网络图谱 (Dependency Graph)

Lead 在规划任务前，必须输出一份 `pipeline/2_planning/dependency_graph.md` 的依赖树。
**示例**:

```markdown
# 购物车功能图谱

[DB Schema 定义] --(阻塞)--> [API Controller 实现]
[UI 组件封样] --(阻塞)--> [API Controller 实现] # 需要等前后端约定就绪
[API Controller 实现] --(阻塞)--> [联调与集成测试]
```

## 3. `task.md` 官方标准模板

使用以下格式生成 `pipeline/2_planning/task.md`。使用 GitHub Checkbox 语法与我们专用的兵种标签。

**调度铁律**: 每个 Task 的 `Blocker` 字段是唯一的依赖声明。任务的启动条件 = 所有 Blocker 已完成，无需等待同 Phase 内其他无关任务。Phase 分组仅用于视觉组织，不构成执行约束。

```markdown
# 实施计划与并发检查单 (Execution Plan)

<!-- Author: Lead -->

> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明，无额外 Phase 闸门约束。

## [Phase 1] 基础骨架 (无依赖，完全并行)

- [ ] T-01 `[Assignee: db-schema-designer]`: 在 `schema.prisma` 新增 `Cart` 和 `CartItem` 模型 (Blocker: None)
- [ ] T-02 `[Assignee: fe-ui-builder]`: 创建 `components/CartIcon.tsx` (Blocker: None)
- [ ] T-03 `[Assignee: be-domain-modeler]`: 编写购物车价格计算引擎的核心业务逻辑 (Blocker: None)

## [Phase 2] 集成区 (按 Blocker 自然解锁)

- [ ] T-04 `[Assignee: be-api-router]`: 将 T-03 的引擎包裹为 RESTful 接口 (Blocker: T-01, T-03)
- [ ] T-05 `[Assignee: fe-logic-binder]`: 前端通过 SWR 挂载接口，完成组件状态绑定 (Blocker: T-02, T-04)
```

## 4. 特种兵认领规则

当进入 Stage 5（实施阶段）后，处于等待并发池里的特种兵（如 `be-api-router`）必须首先扫描这个 `task.md`，寻找是否有自己带有 `[Assignee: xxx]` 标记的任务，并检查它的 `(Blocker)` 是否已经全部打勾。如果是，则立即投入对应的代码生产。
