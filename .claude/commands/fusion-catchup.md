---
description: 【记忆唤醒】从意外中断中恢复，重新读取进度看板与任务堆栈
argument-hint: "[可选: '深度']"
allowed-tools: Read, Grep, Glob, Bash
---

# /fusion-catchup - 断点恢复与记忆读取

当你因为系统重启、终端死机或上下文被截断后醒来，人类 Commander 会输入 `/fusion-catchup` 来唤醒你。

## 执行动作

### Step 1: 读取进度看板（必须检查文件存在性）

依次尝试读取以下文件，**读取前先用 Glob 确认文件存在**：

1. `pipeline/monitor.md` — 整体处于 Stage 几，卡在哪个 Gate
2. `pipeline/2_planning/task.md` — 哪些任务已完成，哪些未开始
3. `pipeline/0_requirements/FEATURE_LIST.md` — 追踪总表当前状态

**降级规则**:
- monitor.md 不存在 → 报告 "项目尚未初始化（无 monitor.md）"，建议 Commander 运行 `/fusion-init`
- task.md 不存在 → 报告 "尚未进入 Stage 3（无 task.md）"，仅基于 monitor.md 报告状态
- FEATURE_LIST.md 不存在 → 跳过追踪矩阵汇报

### Step 2: 深度模式（参数为 '深度' 时额外执行）

- 读取 `pipeline/monitor.md` 中 Stage 5 Task 级追踪表（如果当前在 Stage 5/6）
- 读取最近的审计报告 `pipeline/5_dev/audit/` 或 `pipeline/3_review/`
- 读取 FEATURE_LIST.md 追踪总表，汇报各列完成百分比

### Step 3: 状态报告

用最极简的 3-5 句话向 Commander 汇报：

```
当前阶段: Stage X — [阶段名称]
任务进度: [已完成/总数] 任务已完成（仅当 task.md 存在时）
追踪矩阵: [N]% 功能已实现（仅当 FEATURE_LIST.md 存在时）
下一步: [具体建议]
Commander，我已恢复位置感，请下达指令。
```
