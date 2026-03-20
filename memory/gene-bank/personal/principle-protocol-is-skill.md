# 协议可以通过 Skill 分发，不需要基础设施

**类型**: Principle
**来源**: Chorus Phase 4→5 架构转向 — 2026-03-19
**场景**: 设计 LLM-powered Agent 之间的通信标准时

## 内容

Chorus 是跨文化语义适配**协议**（信封格式 + 文化适配行为规范）。Skill 文件是协议的**分发载体**——教 Agent 学会用 Chorus 协议，但 Skill ≠ Chorus。

类比：TCP/IP 是协议，RFC 文档是教你用协议的载体。不能说"TCP/IP 是一份 RFC"。

当通信双方都是 LLM Agent 时，协议的分发不需要服务器/SDK/基础设施。它可以通过 Skill 文件分发——Agent 加载后就"学会"了这种通信方式。

推导链：
1. LLM Agent 天生能学技能（prompt/skill 即可改变行为）
2. 跨文化沟通的本质是行为模式（提取语义 → 包信封 → 文化适配），不是基础设施
3. 因此：SKILL.md + envelope schema = 完整的协议分发
4. 中心服务器降级为可选中继（给没有域名的 Agent 用，像 Gmail 之于 SMTP）
5. 发现/传输/认证交给宿主协议（A2A/MCP/HTTP），Chorus 只管"找到之后怎么好好说话"

成本影响：协议维护者的运维成本从"一台服务器"降至"零"。产品从"你要部署的服务"变为"你 npm install 的包"或"Agent 加载的一个文件"。

## 反例

花 4 个 Phase 建设 Router 服务器（注册/发现/鉴权/容器化），然后发现与 A2A 在 12+ 维度上全面落后——因为走错了赛道。Chorus 的生态位不在基础设施层，在语义适配层。
