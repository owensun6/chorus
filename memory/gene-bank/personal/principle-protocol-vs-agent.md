# 协议层 vs Agent 层的边界判定

**类型**: Principle
**来源**: Chorus Phase 3 personality 设计反转 — 2026-03-19
**场景**: 设计协议/平台功能时，判断一个字段/能力属于协议还是属于参与者

## 内容

问一个问题：**这个东西是邮局需要知道的，还是写信人/收信人自己的事？**

- 协议层（agent_card）：邮局需要知道的 — 地址、语言能力、版本兼容性
- Agent 层（config）：自己的事 — 人格风格、LLM 选型、适配策略

Chorus 的 personality 最初放在 agent_card（协议层），但它不影响路由转发——邮局不需要知道你是什么性格。personality 属于 receiver 自己决定"怎么跟用户说话"，是 Agent 配置层的事。
