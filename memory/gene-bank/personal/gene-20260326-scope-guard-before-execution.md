---
id: gene-20260326-scope-guard-before-execution
trigger: 'when starting any new task or feature request'
action: 'do read-only exploration phase first — read all referenced docs, summarize understanding, get approval before touching any file'
confidence: 0.7
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-26'
updated: '2026-03-26'
evidence:
  - date: '2026-03-26'
    context: 'Insights 报告显示 39 次方向错误事件，根因均为 Claude 在理解范围前贸然执行'
  - date: '2026-03-24'
    context: 'Bridge v2 架构多轮被打回，根因是未读完设计冻结文档就开始产出'
---

# Scope Guard：探索先行，执行在后

## Action

新任务启动时，强制两阶段模式：
1. 只读探索阶段（Read + Grep + Glob，无 Edit/Write）
2. 结构化摘要 → Commander 确认 → 才进入实施

物理防线：UserPromptSubmit 钩子注入提醒（比 defaultMode:plan 更轻量）。

## Evidence

- 39 次 wrong_approach 事件（Insights 10 天数据）
- Bridge v2 Gate 1 多轮 REJECT，因未读完 design-freeze.md 就产出架构文档
- 医疗产品误定义为子模块（未读白皮书）
- 门诊 vs 住院混淆（未读 PRD 就下结论）
- GitHub 最佳实践：zulip 四阶段、dagster ExitPlanMode 拦截、lisa 三层防御
