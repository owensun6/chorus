# 隔离提交与版本法典 (Git Workflow)

> **[!] CRITICAL (战场清理)**: 每一个 Commit 都是弹壳，每一次 PR 都是战报。拒绝任何诸如 "update" 一类的敷衍报告。

## 1. 原则：主分支神圣不可侵犯 (Main Branch is Immutable)

任何人（包括人类 Commander）不允许向 `main` / `master` 分支直接 Push 代码。所有特征开发必须开启新的战壕。

## 2. Worktree 特征切分 (Feature Branching via Worktree)

- 执行任务前，主动建议或自主创建隔离的 Git Worktree 战场（如：`git worktree add ../feature-pay-cart feature-pay-cart`），防止污染现有代码区的环境。
- 绝不在正在开发的半成品脏工作区里强行切分支救火。

## 3. 弹壳刻字 (Standardized Commit Messages)

每次提交，必须使用 Semantic Commits 规范：

```
<type>: <description>

[可选的长描述，说明为什么这样做 (Why) 而不是做了什么 (What)]
```

**Type 字典**:

- `feat`: 新增特征 (例如一把从没见过的武器)
- `fix`: 修复 Bug (例如给漏水的枪管打补丁)
- `refactor`: 重构代码结构但不改变行为
- `docs`: 修改说明书
- `test`: 仅针对测试代码操作
- `chore`: 配置/底层清理工作

## 4. PR 战况陈述书 (PR Workflow)

创建一个合并请求 (Pull Request) 时，需要提供至少三大板块：

1. **Diff 扫描**: 汇总改动了哪些文件和接口。
2. **综合报告**: 向下一位检阅者阐述此次解决的 PRD 核心点。
3. **测试跑线明细**: 将你在本地运行的 Unit/E2E 结果粘贴至说明内，用数据证明绿灯。
