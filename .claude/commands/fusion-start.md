---
description: 【启动项目】引导 Commander 启动新项目
argument-hint: ''
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# /fusion-start — 启动新项目

你现在接到了 Commander 的新项目启动指令。严格按以下步骤执行：

## Step 1: 获取项目信息

向 Commander 询问（如果 $ARGUMENTS 中没有提供的话）：

- **项目名称**: 这个项目叫什么？
- **一句话描述**: 用一句话说明你要做什么？

## Step 2: 初始化项目骨架

运行以下 shell 脚本建立 pipeline 目录和 monitor.md：

```bash
bash bin/scripts/start-project.sh "<项目名称>" "Commander"
```

如果 `bin/scripts/start-project.sh` 不存在，运行 pipeline 初始化脚本：

```bash
bash .claude/scripts/init_pipeline.sh "$(pwd)/pipeline"
```

如果该脚本也不存在，手动创建以下目录结构：

- `pipeline/0_requirements/audit/`
- `pipeline/0_5_prototype/Wireframes/stitch-raw/` + `audit/`
- `pipeline/1_architecture/ADR/` + `audit/`
- `pipeline/1_5_prototype/UI_Mockups/` + `Revised_Mockups/`
- `pipeline/2_planning/specs/`
- `pipeline/5_dev/audit/`
- `pipeline/3_review/e2e-screenshots/`
- `pipeline/4_delivery/`

并在 `pipeline/monitor.md` 中填入项目名称、当前日期，将 Stage 0 标记为 🟡 进行中。

## Step 3: 切换为 PM 角色，启动需求对话

初始化完成后，你必须立即切换为 **PM（产品经理）** 角色。

读取以下文件获取 PM 的行为规范：

1. `.claude/skills/pm/SKILL.md`
2. `.claude/skills/pm/sub/fusion-pm-interview.md`

然后以 PM 身份向 Commander 发起苏格拉底式需求追问。你的目标是：

- 理解 Commander 真正想要什么（不是表面的，是本质的）
- 追问边界条件、异常场景、非功能性需求
- 确认优先级和范围

**PM 的禁区**：不许谈技术实现、不许写代码、不许选技术栈。只关注"做什么"和"为什么"。

## Step 4: 需求锁定后产出 PRD

当 Commander 的需求足够清晰时，读取意图提取规范：

- `.claude/skills/pm/sub/fusion-compile-req.md`

产出两份文件：

1. `pipeline/0_requirements/PRD.md` — 结构化需求文档
2. `pipeline/0_requirements/BDD_Scenarios.md` — 行为驱动测试场景

提交给 Commander 审批（Gate 0）。

---

**参数**: $ARGUMENTS 可选，可直接传入项目名称和描述。
**示例**: `/fusion-start 医院挂号系统`
