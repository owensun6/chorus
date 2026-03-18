<!-- Author: Lead -->

# TASK_SPEC T-07: 验证运行器 CLI

**Assignee**: be-domain-modeler
**Blocker**: T-03, T-04, T-05, T-06
**F-ID**: F4

## 目标

实现 `chorus-validate` CLI：读取语料 → 三组 LLM 调用 → Judge 评分 → 输出报告。

## 交付物

- `src/runner.ts` — CLI 入口，编排三组实验
- `tests/runner.test.ts` — 单元测试（mock 依赖模块）

## 验收命令

```bash
npx jest tests/runner.test.ts --coverage
# exit 0 = 通过，覆盖率 ≥ 80%
```

## 约束

- 三组实验精确定义按 INTERFACE.md 表格
- Group A: 裸 LLM 翻译（无信封无提示词）
- Group B: 仅必填字段 + 提示词
- Group C: 全部字段 + 提示词
- 输出格式严格按 INTERFACE.md report.json 规范
- 支持 `--single` 模式（调试用，跑单条）
- 失败的 LLM 调用计入 error 统计，不中断整体运行
