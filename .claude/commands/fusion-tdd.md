---
description: 在融合引擎中强制开启一次 TDD 纪律驱动的手动审判重构
argument-hint: '<目标重构文件/功能>'
allowed-tools: Bash, Editor
---

# /fusion-tdd - TDD 纪律判官

当你想要为一个缺失测试的文件补全单测，或者需要遵循红绿法则全新开发某一段核心业务时，召唤此判官。

## 什么是 fusion-tdd

原版 `/ecc-tdd` 在 Fusion-Core 系统下已经内化为了 Git Hook (`npm run test:coverage`) 的静态检查。
此 `/fusion-tdd` 指令的职责是：**以雷霆手段，强迫你（当前 Agent）进入代码重构阶段的极刑模式。**

## 执行极刑三部曲 (RED - GREEN - REFACTOR)

收到指令后，按照 fusion-workflow Stage 5 的 TDD 纪律（`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`）以及各 Dev 兵种 SKILL.md 中的红绿重构循环严格作业：

### 1. RED (写必须挂掉的针对性单测)

- 要求：在你开始写任何 `src/` 下的功能代码之前，**必须先写**位于 `tests/` 目录下的 `.test.ts`。
- 执行：跑 `npm run test`，并将结果展示给 Commander（人类统帅），必须是 FAIL，以证明测试的真正约束性。

### 2. GREEN (写通过测试的最丑代码)

- 要求：此时你才被允许触碰 `src/` 代码。写最少的、哪怕很笨的纯函数代码让单测通过。
- 执行：跑 `npm run test`，必须是 PASS 满江绿。

### 3. REFACTOR (重构提取)

- 要求：现在你可以尽情在绿灯的保护下重组代码架构了，提取常量，遵守 `coding-style.md`。

## 纪律要求

没有获得 Green Pass 之前，你没有权限进行所谓的“代码架构宏大设计”或越界修改别的文件。
在过程的最后跑一趟 `npm run test:coverage` 确保目标文件覆盖率在 80% 以上。
