# Stage 5: TDD 并发实施 — 原子进度追踪

> 角色: Dev（6 兵种按 DAG 并发）
> 上游依赖: Stage 4 Worktree 就绪 + Task 追踪表已生成
> 子技能: 各兵种 `sub/fusion-*.md`
> Task 级追踪: 见主 `pipeline/monitor.md` 的 Stage 5 Task 级追踪表

## 每个 Task 的 TDD 原子循环（Dev 兵种通用）

> 以下为单个 T-ID 的执行序列，每个 Task 独立跟踪。

| # | 原子步骤 | 完成标志 |
|---|---------|---------|
| 1 | 读取 monitor.md 确认上游 Blocker 已完成 | Blocker 全部 `[x]` |
| 2 | 读取 TASK_SPEC_T-{ID}.md（BDD + 结构性约束） | Given-When-Then 条数 + 结构性约束项数已确认，测试断言数 = BDD 条数 + 结构性约束条数 |
| 3 | 🔴 RED: 从 BDD 逐条生成测试断言 | `.spec.ts` 文件已写入 + 断言数 = BDD 条数 |
| 4 | 🔴 RED: 运行测试，确认全部 FAIL | 终端输出 FAIL + 失败数 = 断言数 |
| 5 | 🔴 RED: `git commit -m "test(red): T-{ID} ..."` | commit hash 已记录 |
| 6 | 🟢 GREEN: 编写最简实现让测试通过 | 终端输出 ALL PASS + 0 failures |
| 6.5 | 🔒 SECRET SCAN: 提交前密钥扫描 | `grep` 扫描变更文件无 API_KEY/SECRET/PASSWORD 模式 |
| 7 | 🟢 GREEN: `git commit -m "feat(green): T-{ID} ..."` | commit hash 已记录 + 时间晚于 RED commit |
| 7.5 | 🟡 LINT: 运行 `bin/fusion-lint.sh` L2-L5（Author/残留/行数） | lint exit 0（无 ERROR）；有 WARNING 则在 REFACTOR 中修复 |
| 8 | 🔵 REFACTOR: 清理代码（函数 < 40 行，文件 < 300 行） | 每函数 ≤ 40 行 + 每文件 ≤ 300 行 + 测试仍 PASS + lint WARNING 已清除 |
| 9 | 🔵 REFACTOR: `git commit -m "refactor: T-{ID} ..."` | commit hash 已记录 |
| 10 | 在 monitor.md 本行 Worker 标为 `[x]` | monitor.md 对应 T-ID 行 Worker = `[x]` |
| 10.5 | 调用 code-simplifier 简化 + 验证测试 + commit | Simplify = `[✓]` 或 `[SKIP]` |
| 11 | 进入 QA 轮询循环 | `[✓]` → 正常退出 / `[✗]` → 读取审计报告返工 |

## Task 实例追踪（由 Dev 在执行中填写）

| T-ID | Assignee | RED commit | GREEN commit | Worker | Simplify | QA |
|------|----------|-----------|-------------|--------|-----|
| | | | | | | |

> 此表在实际项目中由 Dev 逐行填写。RED/GREEN commit 列是 TDD 证据链的物理记录。
