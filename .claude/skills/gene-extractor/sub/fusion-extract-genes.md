---
name: fusion-extract-genes
description: gene-extractor 专用。从近期对话与产出物中识别跨项目可复用模式，生成 Gene 文件。
---

# fusion-extract-genes — 战役经验基因提取


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 提取跨项目可复用经验写入 Gene Bank
2. **这些步骤已经不可原子级再分了吗？**
   → 回顾近期对话 → 识别模式类型 → 判定 Gene 价值 → 生成 Gene 文件 → 更新 EXPERIENCE.md，每步独立。

---

## 什么值得提取（Gene 价值判定）

**值得提取的模式**:

| 类型                  | 示例                                         |
| --------------------- | -------------------------------------------- |
| Workflow 修改需求     | "Stage 0 PM 只从用户体验逼问，需要四维度"    |
| Coding Style 新反模式 | "Node.js 内联 bash `\!` 转义问题"            |
| SKILL.md 补丁         | "角色边界不清导致越界"                       |
| 跨项目通用错误模式    | "hook 正则不支持空格，Author tag 需用连字符" |
| 工具/技术教训         | "python3 替代 Node.js heredoc 避免转义问题"  |

**不提取的内容**:

- 只与当前项目业务逻辑相关的经验 → 写入 MEMORY.md，不写 Gene Bank
- 单次偶发问题，无法推广 → 不提取

---

## 执行步骤

### Step 1: 回顾近期对话

回顾最近 2-3 轮工作中发生的：

- 什么问题被打回了？原因是什么？
- 什么决策被修改了？为什么？
- 哪些地方走了弯路？根因是什么？

### Step 2: 识别跨项目模式

对每个问题/决策：

- 它在其他项目中会再次出现吗？（可复用 → 是 Gene）
- 它只与当前项目业务相关吗？（不可复用 → MEMORY.md）

### Step 3: 生成 Gene 文件

```markdown
# Gene-[序号]: [一句话标题]

**置信度**: 0.5（初始）
**来源**: [项目名] [日期]
**类型**: workflow / coding-style / skill-patch / error-pattern / tool-lesson

## 现象 (Observation)

[描述遇到的问题或发现]

## 根因 (Root Cause)

[为什么会发生这个问题？]

## 模式 (Pattern)

[可复用的规律是什么？]

## 修复方向 (Fix Direction)

[如何在 workflow/skill/rules 中修复？]

## 置信度演化

- 0.5 初始记录（1次）
- 0.6 第二个项目中复现 → 提升置信度
- 0.9 多次验证 → 演化为 SKILL.md 补丁
```

Gene 文件存储路径：`memory/gene-bank/personal/campaign-<id>.md`

### Step 4: 更新经验日志

追加条目到 `memory/experience/EXPERIENCE.md`：

```markdown
| 日期       | Gene ID | 一句话描述          | 置信度 | 状态   |
| ---------- | ------- | ------------------- | ------ | ------ |
| 2026-03-04 | G-001   | hook 正则不支持空格 | 0.5    | 待验证 |
```

---

## 注意事项

- **早提取，不要等 Stage 7**: 战役可能中途停止，早提取确保经验不丢失
- **Gene Bank ≠ MEMORY.md**: Gene Bank 是跨项目的；MEMORY.md 是当前项目的
- **Commander 会人工 review**: 不自动部署到 rules，由 Commander 决定是否演化为规则
