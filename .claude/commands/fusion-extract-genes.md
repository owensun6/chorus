---
description: 【基因萃取】从战役中提取可复用经验写入 Gene Bank
argument-hint: ''
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# /fusion-extract-genes — 兵种基因萃取

从当前战役的 git 历史和 review 记录中提取可复用的经验模式。

## 使用方式

```
/fusion-extract-genes
```

## 执行流程

1. 运行 `npx fusion-core extract-genes` 收集原材料（git log + review 记录）
2. 读取技能手册: `.claude/skills/gene-extractor/SKILL.md`
3. 分析原材料，按 5 种模式类型提取 Gene
4. 将 Gene 文件写入 `memory/gene-bank/personal/`
5. 报告萃取结果摘要

## 自动触发

Stage 7 完成分支后自动执行。也可手动触发。
