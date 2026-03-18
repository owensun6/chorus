# 性能与上下文续航指南 (Performance & Context Survival)

> **[!] CRITICAL (心智抗压)**: AI 的算力和记忆窗口是昂贵的。不要在小池塘里放巨兽，也不要用苍蝇拍去打龙。

## 1. 兵种与模型选排策略 (Model Dispatch)

- **Haiku / 快速模型**: 适用于 `Syntax`, `Spec` 等只需简单比对和语法扫描的底层 Reviewer 特种兵。
- **Sonnet / 中坚力量**: 适用于 `fe-*` 和大部分 `be-api-router` 等可确定性分发的日常生产编码任务。
- **Opus / 思维深渊**: 仅限于 `PM`, `Lead` 军团的架构规划，或者遇到极难修的死胡同 Bug。

## 2. 内存黑洞防御 (Context Window Management)

随着对话的历史推移，大模型的智力会加速滑坡。

- **定期斩断**: 遇到复杂开发，如果单次 Session 的历史积累太长，用 `pipeline/monitor.md` 确认当前进度后，果断开启全新的 Session 继续战斗。
- **只读取必要的文件**: 不要为了看一个属性而通读上千行的全局 `utils.js`，要善用 `grep` 去精准定位函数签名。
- **少读，多想**: 阅读文件前预测一下位置。一旦确认目标，只看核心块。

## 3. Plan Mode 深度构想 (Extended Thinking)

- 永远保持 **“思考先行”** (Explain Before Act) 的第一性原理。
- 当遇到无法立刻破局的问题时，必须在你的内部思绪里划分出至少 3 步走棋法。不可一拍脑门盲目修 Bug，结果越修越坏。
