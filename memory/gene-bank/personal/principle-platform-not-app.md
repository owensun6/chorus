# 平台思维：路由器不调 LLM

**类型**: Principle
**来源**: Chorus Phase 4 部署规划 — 2026-03-19
**场景**: 设计协议平台的部署方案时

## 内容

Chorus 路由服务器是协议平台（类似 SMTP），不是应用。路由器只转发信封，不拆信、不翻译、不调 LLM。每个 Agent 自带 LLM 和 API key。

部署路由器的复杂度 = 部署一个轻量 HTTP 中继，不需要考虑 LLM 成本控制、API key 管理、速率限制等 Agent 侧的事。

## 反例

把 demo（agent + router + web UI 打包运行）的特征当作平台特征，导致部署清单中错误列出"LLM 速率限制"、"DASHSCOPE_API_KEY 管理"等不属于路由器的需求。
