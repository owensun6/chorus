<!-- Author: Lead -->

# Phase 5 实施计划（v2 — 头脑风暴后重建）

> **背景**: SKILL.old.md 思想未对齐新 PRD。L1/L2 物理分离 + 双语 + npm CLI 分发。
> **调度依据**: 每个 Task 的 Blocker 字段即为唯一依赖声明。

## [Phase 1] 基础骨架（并行启动）

- [ ] T-01 `[Assignee: be-domain-modeler]`: **PROTOCOL.md (en)** — 编写 L1 协议规范英文版。包含：Chorus 定义（跨平台通信标准）、Envelope 格式表、Protocol Rules（MUST/MUST NOT/MAY）、版本兼容性。~60-70 行。参考设计方案中确认的 PROTOCOL.md 结构。(Blocker: None)

- [ ] T-08 `[Assignee: be-domain-modeler]`: **README.md + L3 标注验证** — 更新项目根 README.md 反映 PROTOCOL.md/SKILL.md 分离和 npm CLI 分发。验证 src/server/index.ts、src/agent/index.ts、src/demo/index.ts 均有 L3 标注。(Blocker: None)

## [Phase 2] 内容展开（T-01 完成后解锁）

- [ ] T-02 `[Assignee: be-domain-modeler]`: **PROTOCOL.md (zh-CN)** — 从 T-01 英文版翻译为中文版。文件名: PROTOCOL.zh-CN.md。(Blocker: T-01)

- [ ] T-03 `[Assignee: be-domain-modeler]`: **SKILL.md (en)** — 编写 L2 教学文档英文版。YAML frontmatter（name/description/version）+ 8 节结构：What is Chorus / Your Role / Sending / Receiving / Proven Prompts / DO NOT / Envelope Reference。引用 PROTOCOL.md。包含 Phase 0-4 验证过的提示词模板（标注为参考实现）。(Blocker: T-01)

- [ ] T-05 `[Assignee: be-domain-modeler]`: **同文化示例** — 在 examples/ 新增 en-to-en.json（同文化场景：Envelope 无 cultural_context，接收方直接转达）。展示 Chorus 作为跨平台通信标准的基本用法。(Blocker: T-01)

## [Phase 3] 翻译 + 验证（T-03 完成后解锁）

- [ ] T-04 `[Assignee: be-domain-modeler]`: **SKILL.md (zh-CN)** — 从 T-03 英文版翻译为中文版。文件名: SKILL.zh-CN.md。提示词模板保留原语言（中文模板用中文，日文模板用日文）。(Blocker: T-03)

- [ ] T-07 `[Assignee: be-domain-modeler]`: **跨平台验证** — 启动隔离 Agent，仅传入 SKILL.md (en) + PROTOCOL.md (en)。测试：(a) 同文化发送（Envelope 无 cultural_context）；(b) 异文化发送（Envelope 含 cultural_context）；(c) 异文化接收适配。记录结果到 pipeline/phase5/3_review/cross-platform-validation.md。(Blocker: T-03)

## [Phase 4] 打包分发（所有内容就绪后）

- [ ] T-06 `[Assignee: be-domain-modeler]`: **npm CLI 包 @chorus-protocol/skill** — 创建 packages/chorus-skill/ 目录。package.json（bin 字段指向 CLI 入口）+ CLI 脚本（init 命令：--lang en|zh-CN，复制对应语言版本的 PROTOCOL.md + SKILL.md + envelope.schema.json + examples/ 到当前目录的 chorus/ 下）。(Blocker: T-02, T-04, T-05)
