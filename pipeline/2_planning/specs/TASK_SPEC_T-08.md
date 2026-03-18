<!-- Author: Lead -->

# TASK_SPEC T-08: 运行实验 + 生成报告

**Assignee**: be-ai-integrator
**Blocker**: T-07
**F-ID**: F4

## 目标

运行完整 200 条实验，验证 A-05 和 A-08 假设，输出结论。

## 交付物

- `results/report.json` — 完整实验报告
- `results/summary.md` — 人类可读的结论摘要

## 验收命令

```bash
test -f results/report.json && node -e "const r=require('./results/report.json'); console.assert(r.summary); console.assert(r.meta.total_cases===200); console.log('PASS')"
# exit 0 = 通过
```

## 约束

- 需要有效的 LLM API Key（环境变量 `LLM_API_KEY`）
- 先运行一致性验证（20 条），确认 Kappa ≥ 0.6 后再跑全量
- summary.md 明确结论：A-05 成立/不成立，A-08 成立/不成立
- 如果 A-08 不成立（C ≈ B），在结论中建议砍掉可选字段
