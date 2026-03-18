---
description: 【推演评估】在请求 Commander 签字 (Gate Approval) 之前，给出主观与客观的完成度评估
argument-hint: ''
allowed-tools: Read
---

# /fusion-confidence - Gate 终结置信度评估

这是你对自己工作的客观评价报告。不要盲目自信，不要讨好人类。

## 执行动作

1. 回顾最近的 `task.md` 目标与实际完成的源代码。
2. 给出综合置信度得分 (0 - 100%)。
3. 列出扣分点，例如：
   - 依赖的下游 API 还没写完，属于 Mock 状态 (-10%)。
   - 包含某些难以理解的复杂解构 (-5%)。
   - 没有覆盖所有的 Edge case (-5%)。
4. **决策建议**：低于 90% 的状况下，你必须**主动劝阻** Commander：暂缓按下通过该 Gate 的印章。
