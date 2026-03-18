<!-- Author: Lead -->

# TASK_SPEC T-05: LLM-as-Judge 评分模块

**Assignee**: be-ai-integrator
**Blocker**: None
**F-ID**: F4

## 目标

实现 LLM-as-Judge 盲评：对一条翻译输出按三维度打分。

## 交付物

- `src/judge.ts` — scoreOutput(), validateConsistency()
- `tests/judge.test.ts` — 单元测试（mock LLM 响应）

## 验收命令

```bash
npx jest tests/judge.test.ts --coverage
# exit 0 = 通过，覆盖率 ≥ 80%
```

## 约束

- scoreOutput(input, output, sourceCulture, targetCulture, context): 调用 LLM → 返回 {intent: 1-5, cultural: 1-5, natural: 1-5}
- 评分量表直接内联在代码中（内容来自 INTERFACE.md chorus-judge-rubric 规范），不依赖外部文件
- 盲评：不告诉 judge 该输出来自哪组
- LLM 返回非 JSON 或分数超范围 → 重试 1 次 → 仍失败则标记该条为 error
- validateConsistency(): 对 20 条随机样本做两次评分 → 计算 Cohen's Kappa
