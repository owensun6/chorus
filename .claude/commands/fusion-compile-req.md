---
description: 【零介入编译器】将自然语言需求一步编译为 PRD + BDD
argument-hint: ''
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# /fusion-compile-req — 零介入需求编译器

将自然语言需求直接编译为 PRD + BDD 契约文件。

## 使用方式

```
/fusion-compile-req <自然语言需求描述>
```

## 执行流程

1. 读取技能手册: `.claude/skills/pm/sub/fusion-compile-req.md`
2. 以 PM (Zero-Shot Compiler) 身份执行编译
3. 输出两个文件到 `pipeline/0_requirements/`:
   - `PRD.md` — 含编译器自动推断的边界假设
   - `BDD_Scenarios.md` — 严格 Gherkin 格式
4. 提交 Gate 0 等待 Commander 审批

## 退回条件

如果需求过于模糊（无法推断出至少 1 个 Success + 1 个 Error 场景），自动退回 `fusion-pm-interview` 多轮逼问路径。
