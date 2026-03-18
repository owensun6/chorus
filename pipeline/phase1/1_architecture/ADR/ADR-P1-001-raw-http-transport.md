<!-- Author: Lead -->

# ADR-P1-001: 使用 A2A 兼容 JSON + Raw HTTP 传输（不依赖 A2A SDK）

## 背景（Context）

Phase 1 需要 Agent 间通信。PRD 假设 A-P1-04 指出"A2A DataPart 传输 Chorus Envelope 在实际 A2A SDK 中可行"，但此假设被评为 **Impact=H, Risk=H**。

具体风险：
1. A2A SDK 可能不支持自定义 `mediaType` 的 DataPart
2. SDK 可能对 `Part.data` 有额外序列化逻辑（base64、封装）
3. SDK 的 SendMessage 实现可能校验/过滤未注册的扩展

同时，Phase 1 的路由服务器是自定义 HTTP 服务（非 A2A Server），Agent-to-Server 通信本质上就是 HTTP。

## 考虑的选项（Options）

| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 使用 A2A JS SDK (@a2a-js/sdk) | 标准协议、未来互操作 | H×H 风险未验证、增加依赖、SDK 行为不确定 |
| B: Raw HTTP + A2A 兼容 JSON | 零 SDK 风险、Phase 0 已验证、完全可控 | 非标准传输、未来需要迁移到 SDK |
| C: 先 Spike 验证 A2A SDK，再决定 | 充分验证后决策 | 增加时间成本、Spike 可能发现不支持后仍需 fallback 到 B |

## 决策（Decision）

选择 **选项 B: Raw HTTP + A2A 兼容 JSON**。

**原因**（FP 两问）:
1. **目的是什么？** — 让两个 Agent 通过路由服务器可靠通信。A2A SDK 不是目的，可靠通信才是。
2. **这步可以删除吗？** — A2A SDK 这个中间层可以删除。JSON 格式 IS the contract，HTTP IS the transport。SDK 只是格式和传输的一层封装——Phase 1 不需要这层封装。

**实施方式**:
- 消息 JSON 结构**完全遵循** A2A Message 格式（`role`、`parts[]`、`extensions[]`）
- Chorus 信封作为 DataPart（`Part.data` + `mediaType`）
- 传输层使用普通 HTTP POST（Node.js fetch / undici）
- 路由服务器使用 Express/Hono 等 HTTP 框架

**A2A 兼容性保证**:
- 任何符合 A2A 规范的 Agent 读取 Phase 1 产生的 JSON，能正确解析
- Phase 2 迁移到 A2A SDK 时，只需替换传输层，不需修改业务逻辑

## 后果（Consequences）

- **正向**: 消除 A-P1-04 的 H×H 风险；减少一个外部依赖；Phase 0 的 JSON 构造代码可部分复用
- **负向**: Phase 2 引入第三方 A2A Agent 时需要评估 SDK 迁移成本
- **被拒方案**: 选项 A 因 H×H 风险不可接受被放弃；选项 C 因增加时间成本且最终大概率 fallback 到 B 被放弃
