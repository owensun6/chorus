# Stage 3 + 4: DAG 规划 + 隔离环境 — 原子进度追踪

> 角色: Lead
> 上游依赖: Commander 确认设计文档
> 子技能: `fusion-dag-builder`（Stage 3） → `fusion-worktree`（Stage 4）

## Stage 3: DAG 任务规划

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 1.1 | Stitch 复用审计（fe-ui-builder Task 前置） | ⬜ | | `stitch-code/` 扫描结果：有 HTML → 复用，无 → 从零 |
| 1.2 | 分析设计文档，识别独立任务边界 | ⬜ | | 任务边界列表：每任务标注文件路径隔离范围 |
| 1.3 | 按特种兵分配任务（6 兵种，禁止笼统 Dev） | ⬜ | | 每 Task 有具体 Assignee 兵种名 |
| 1.4 | 每条 Task 过三问过滤 | ⬜ | | 三问记录：存在理由 / 可删否 / 可再分否 |
| 1.5 | 产出 dependency_graph.md | ⬜ | `dependency_graph.md` | DAG 节点数 = Task 数 + 无孤立节点 |
| 1.6 | 死锁检查（无循环依赖） | ⬜ | | 拓扑排序可完成（无环） |
| 1.7 | 产出 task.md | ⬜ | `task.md` | 首行 `<!-- Author: Lead -->` + 每 Task 有 Assignee + Blocker |
| 1.8 | 逐个产出 TASK_SPEC_T-{ID}.md（BDD 验收标准） | ⬜ | `specs/TASK_SPEC_T-*.md` | TASK_SPEC 文件数 = task.md Task 数 + 每份含 Given-When-Then |
| 1.9 | 每份 TASK_SPEC 填写「测试规格」章节 | ⬜ | | 每份 TASK_SPEC 测试规格非空 + test_case 数 ≥ BDD 条数 |
| 1.10 | 每份 TASK_SPEC 填写「结构性约束测试」章节 | ⬜ | | immutability + input_validation 已填（或附 N/A 理由） |
| 1.11 | 更新 FEATURE_LIST 追踪总表"Task"列 | ⬜ | | FEATURE_LIST "Task"列无空值 |
| 1.12 | Harness 就绪检查（测试命令可独立运行） | ⬜ | | 测试运行命令执行返回 exit 0（可为 0 tests） |
| 1.13 | Commander Gate 2 签字 | ⬜ | | monitor.md Gate 2 状态 = ✅ |

## Stage 4: Git Worktree 物理隔离

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 2.1 | Worktree 目录选择 | ⬜ | | 目标路径已确定（.worktrees/ 优先） |
| 2.2 | gitignore 验证（未忽略 → 添加+commit） | ⬜ | | `grep "worktrees" .gitignore` 有匹配 |
| 2.3 | 未追踪文件确认已提交 | ⬜ | | `git status --porcelain` 无未追踪的源文件 |
| 2.4 | 创建 Worktree + 新分支 | ⬜ | `.worktrees/feature-*` | `git worktree list` 含新分支 |
| 2.5 | 安装依赖 | ⬜ | | 包管理器安装命令 exit 0 |
| 2.6 | 基线测试验证（必须全绿） | ⬜ | | 测试命令 exit 0 + 0 failures |
| 2.7 | 生成 monitor.md Task 级追踪表 | ⬜ | 主 `monitor.md` 更新 | 追踪表行数 = task.md Task 数 |
| 2.8 | 通知 Dev 特种兵进入 Stage 5 | ⬜ | | monitor.md Stage 5 状态 = 🟡进行中 |
