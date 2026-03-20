# Chorus v0.3 vs A2A v1.0：5 个致命/严重缺陷

**类型**: Pitfall
**来源**: Chorus Phase 4 协议对标审计 — 2026-03-19
**场景**: 自建 Agent 通信协议时，必须对标行业成熟方案避免重复造劣质轮子

## 内容

与 Google A2A (v1.0) 对标后发现 Chorus Router 在基础设施维度有 5 个致命/严重缺陷：

### 致命（3 项）

1. **身份伪造**: `sender_agent_id` 在 POST body 中自报，零验证。A2A 用 Agent Card JWS 签名 + mTLS。
2. **零传输加密**: Router 监听 HTTP 明文，Bearer token 和消息内容裸奔。A2A 强制 TLS 1.2+。
3. **sender 无法验证**: 任何人可以在 body 中填任意 sender_agent_id 发消息。A2A 凭证在 HTTP header，不在 payload。

### 严重（2 项）

4. **中心化单点故障**: 所有 Agent 通过同一 Router，Router 挂 = 全网瘫。A2A 用 `.well-known` URI 去中心化。
5. **无授权隔离**: 持有同一个 CHORUS_API_KEYS 的任何人可操作任意 agent（注册/删除/代发消息）。A2A 有 per-agent 安全方案 + per-skill OAuth scope。

### 结论

这些缺陷不值得修——在基础设施层追赶 A2A 没有意义。正确做法是放弃基础设施层竞争，将 Chorus 定位为叠加在 A2A/MCP/任意协议之上的语义适配层（Skill），让宿主协议处理身份/加密/发现/授权。
