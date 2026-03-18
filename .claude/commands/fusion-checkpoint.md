---
description: 【安全绳】在重构或风险操作前，建立静态的物理快照备份
argument-hint: '<快照原因描述>'
allowed-tools: Bash, Read
---

# /fusion-checkpoint - 物理级快照打桩

当你或 Commander 准备在此刻的代码基础上进行破坏性修改前，先打下这根安全桩。

## 执行动作

1. **风险提示**：在执行前，先用 `git status` 看一眼。如果工作区非常干净，则无需备份。
2. **打桩**：执行 `git add .` 和 `git commit -m "chore(fusion): checkpoint - ${传入的原因}"`。
3. 如果 `lint-staged` 或 `Husky` 在此时阻断了提交说明存在历史账单，必须警告 Commander：**“未能成功打桩，发现现有代码未能通过审查防线。”**
