---
id: gene-20260326-dont-blindly-apply-feedback
trigger: 'when applying review feedback or expert suggestions to code or architecture'
action: 'do critically evaluate each point against existing architecture before implementing — flag conflicts instead of blindly applying'
confidence: 0.8
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-26'
updated: '2026-03-26'
evidence:
  - date: '2026-03-24'
    context: 'Bridge v2 架构审查中不加判断应用专家反馈，引入 status-semantics Bug 和跨文档不一致，反复阻塞 Gate'
  - date: '2026-03-23'
    context: 'human→user 术语替换过度应用到 bridge 代码和非终端用户上下文，需两轮回退'
  - date: '2026-03-26'
    context: 'Insights 报告 Over-Application and Uncritical Changes 为第二大摩擦类别'
---

# 不盲目应用反馈：批判性评估后再实施

## Action

收到评审反馈时：
1. 逐条评估有效性（与现有架构是否冲突）
2. 标记有问题的条目，向 Commander 说明冲突
3. 只实施经确认的条目

反模式：全盘接受所有反馈 → 引入新 Bug → 比不改更糟。

## Evidence

- Bridge v2 架构审查：uncritical feedback → status-semantics bugs → Gate blocked 3 rounds
- 术语统一：human→user 全面替换 → bridge 代码污染 → 两轮回退
- Insights 22 次 buggy_code 事件中相当比例来自过度应用反馈
