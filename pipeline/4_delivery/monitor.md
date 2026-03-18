# Stage 7: 分支完成与交付 — 原子进度追踪

> 角色: Lead
> 上游依赖: Gate 3 通过（7 道漏斗全部 PASS）
> 子技能: `fusion-finish-branch`

## 交付原子步骤

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 1 | 验收最终状态（全测试通过 + 0 CRITICAL） | ⬜ | | 测试 exit 0 + `grep CRITICAL audit/*.md` = 0 |
| 2 | 清理脏代码（console.log/debugger/TODO/FIXME） | ⬜ | | `grep -rn "console.log\|debugger\|TODO\|FIXME" src/` = 0 |
| 3 | 最终 commit: `chore: Stage 7 收尾清理` | ⬜ | | commit hash 已记录 |
| 4 | 向 Commander 提供合并选项（A/B/C） | ⬜ | | 三选项已陈述（A:本地合并 B:PR C:保留） |
| 5 | 执行 Commander 选择的合并方式 | ⬜ | | Commander 选择已执行 + 无合并冲突 |
| 6 | 清理 Worktree | ⬜ | | `git worktree list` 中无已完成分支 |
| 7 | 更新 FEATURE_LIST 追踪总表 | ⬜ | | "实现"+"QA"列全标 ✅，无空值 |
| 8 | 更新主 monitor.md Stage 7 状态 | ⬜ | | monitor.md Stage 7 = ✅ |
| 9 | （可选）Commander 手动调用 `/fusion-extract-genes` 萃取经验 | ⬜ | Gene Bank 更新 | Commander 决定是否执行 |

## FEATURE_LIST 最终验收矩阵

| F-ID | 功能名称 | PM | 原型 | 接口 | Task | 实现 | QA | 验收 |
|------|---------|-----|------|------|------|------|-----|------|
| | | | | | | | | |

> 此表在实际项目中由 Lead 基于 task.md 完成状态和审计结果填写。
> Commander 逐行检查，全部 ✅ → 项目验收通过。
