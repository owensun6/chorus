---
description: 【外科手术】扫除控制台打印、死代码及无用导入
argument-hint: '[目标目录或文件]'
allowed-tools: Read, Write, Bash
---

# /fusion-cleanup - 死代码物理清扫器

当项目经历了重度重构或 TDD 绿灯通过后，难免留下大量临时脚手架，Commander 会调用此命令。

## 执行动作

1. **严格边界锁定**：你只能删除代码，**绝对不允许改变任何现有的业务执行逻辑**或重构算法结构。
2. 扫描并清除目标中的：
   - 所有未被使用的 `imports` / `requires`
   - 所有 `console.log` / `debugger` / 临时 `alert`
   - 一眼即可判定的 unreachable 代码区块
3. **物理校验纪律**：清扫完成后，必须自动拉起宿主机的 `npm run lint` 和 `npm run format` 进行格式收口，向 Commander 汇报清扫战果。
