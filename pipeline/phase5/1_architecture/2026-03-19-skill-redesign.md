<!-- Author: Lead -->

# Phase 5 设计方案（Commander 确认版）

**日期**: 2026-03-19
**关联 F-ID**: F5.1, F5.2, F5.3, F5.4, F5.5

## 核心升维（本轮头脑风暴新发现）

1. **Chorus 首先是跨平台 Agent 通信标准**——同文化用它互通，异文化时激活文化适配
2. **cultural_context 对话首轮声明一次**——后续轮次不重复，同文化省略
3. **协议 ≠ Skill**——L1 协议规范和 L2 教学文档物理分离

## 交付物结构

```
chorus/
├── PROTOCOL.md          ← L1: 协议规范（独立存在，~60-70 行）
├── envelope.schema.json ← L1: Envelope v0.3 JSON Schema（42 行）
├── SKILL.md             ← L2: 教 Agent 用协议（引用 PROTOCOL.md）
├── examples/            ← L2: 教学辅助
│   ├── zh-CN-to-ja.json
│   └── ja-to-zh-CN.json
└── README.md            ← 人类快速上手
```

双语：PROTOCOL.md 和 SKILL.md 各有 en + zh-CN 版本。

## 分发方式

```bash
npx @chorus-protocol/skill init --lang en      # 英文版
npx @chorus-protocol/skill init --lang zh-CN   # 中文版
```

## 确认的设计决策

| 决策 | 选择 | 来源 |
|------|------|------|
| Chorus 定位 | 跨平台通信标准，异文化时激活适配 | Commander 确认 |
| cultural_context 频率 | 异文化对话首轮一次 | Commander 确认 |
| L1/L2 分离 | PROTOCOL.md + SKILL.md 物理分文件 | Commander 确认 |
| 提示词模板 | 放入 SKILL.md，标注为验证过的参考实现 | Commander 确认（价值主张） |
| 语言 | 双语 en + zh-CN | Commander 确认 |
| 分发 | npm CLI (`npx @chorus-protocol/skill init`) | Commander 确认 |
| YAML frontmatter | 加入 name/description/version | 竞品研究 |
| 写作风格 | 结构 > 散文，MUST/MUST NOT，反模式区域 | 竞品研究 |

## PROTOCOL.md 结构

```
1. Chorus Protocol — 一句话定义
2. Envelope Format — 必填/可选字段表
3. Protocol Rules
   - MUST: 封装为 Chorus Envelope
   - MUST: sender_culture 使用 BCP47
   - MUST (cross-culture, turn 1): 附加 cultural_context
   - MUST (cross-culture, receive): 文化适配
   - MUST NOT: 在 Envelope 中传递 personality
   - MAY (same-culture): 省略 cultural_context，直通
4. Versioning — v0.3 向后兼容 v0.2
```

## SKILL.md 结构

```yaml
---
name: chorus
description: |
  Cross-platform Agent communication protocol. Use when communicating
  with agents from different platforms or cultures.
version: "0.3"
---
```

```
1. What is Chorus — 跨平台通信标准 + SMTP 类比
2. Your Role — 协议参与者（代表用户 / 自主参与）
3. Sending — 同文化直发 / 异文化首轮声明 cultural_context
4. Receiving — 同文化转达 / 异文化适配
5. Proven Prompts — Phase 0-4 验证过的提示词模板
6. DO NOT — 反模式清单
7. Envelope Reference — 引用 PROTOCOL.md
```

## 被拒方案

- 单文件（SKILL.md 包含协议规范）— 混淆 L1/L2 边界
- 不提供提示词模板 — 失去价值主张
- 中文单语言 — 无法作为全球协议
