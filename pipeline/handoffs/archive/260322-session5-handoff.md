# Handoff — 2026-03-22 Session 5

## ⚡ 立即行动（第一步）

1. 设计 OpenClaw Chorus 桥接插件的 1 页技术方案（事件流、hook 点、失败重试）
2. 读 `~/.openclaw/extensions/skill-router/index.mjs` 理解现有 plugin hook 机制
3. 参考 `before_prompt_build` 钩子设计消息注入方案

---

## 当前状态

- **项目**: Chorus Hub — 线上容量验证已通过，进入 Agent 端体验修复阶段
- **Stage**: 非 Fusion-Core 流水线，属于产品体验迭代
- **阻塞点**: Agent 收到 Chorus 消息后不主动通知人类 + 不翻译 — 根因是 OpenClaw 缺少 Chorus 桥接插件

---

## 本会话完成事项

### 线上容量验证（全 PASS）

- 场景 A: 100 SSE / 30min / 0 断连 — 需 heartbeat + hard_limit 修复后才通过
- 场景 B: 100 burst / 100% 成功 / 5xx=0 / SQLITE_BUSY=0
- 场景 C: 100 webhook burst / 100% 成功 / p95=2044ms（公网边缘）
- 场景 D: 30 agents / 30min soak / 1799 msg / p95=292ms / 0 断连 / WAL 稳定
- 备份：soak 后 800KB 一致性备份成功

### 结构性修复

- SSE heartbeat → `src/server/inbox.ts`: 每 20s `:ping\n\n` 注释帧 + `shutdown()` 方法
- hard_limit → `fly.toml`: 100→150, soft_limit 80→120
- webhook-stub → `src/server/routes.ts:567-573` + `src/server/index.ts:65` auth 白名单
- 压测脚本 → `scripts/load/lib.ts`: `withNetworkRetry` 包装 + health 容错
- capacity-report → `docs/server/capacity-report.md`: 全量重写，带边界条件

### 限流收口

- `fly secrets unset CHORUS_RATE_LIMIT_PER_MIN CHORUS_RATE_LIMIT_PER_KEY_MIN` 已执行
- fly.toml 恢复为唯一真相源（60/120）

### 双 Agent 通信测试

- 小V（微信/zh-CN）+ 小X（Telegram/en）注册并互发消息
- Hub 侧投递全部成功（`message_delivered_sse` 确认）
- 发现 3 个体验缺陷：
  1. Agent 不主动开 inbox — 已改 SKILL.md 将注册+开 inbox 合为一步
  2. 收到消息不主动通知人类 — SKILL.md 软约束不够，需平台级硬桥接
  3. 跨语言不翻译 — 可能 skill 未在处理消息时激活

### SKILL.md 更新

- 英文版 `skill/SKILL.md`: 注册步骤加"immediately open inbox"，接收加"MUST immediately deliver"
- 中文版 `skill/SKILL.zh-CN.md`: 同步更新

### Agent 端根因分析

- OpenClaw skill 是被动知识（prompt 上下文），不是事件触发器
- OpenClaw 有 `before_prompt_build` plugin hook（`skill-router` 已在用）
- OpenClaw 有渠道插件体系（telegram、openclaw-weixin 已加载）
- 缺的是：后台 SSE 监听 → 消息到达 → 注入对话流 → 推送人类的桥接插件

---

## 待完成（按优先级）

1. [P0] OpenClaw Chorus 桥接插件技术方案 — 依赖：理解 OpenClaw plugin API（`~/.openclaw/extensions/skill-router/index.mjs`）
2. [P0] 实现最小可用插件：后台订阅 SSE inbox → 收到消息 → 通过 OpenClaw hook 推送给人类渠道
3. [P1] 验证插件效果：重新测试小V + 小X 通信，确认消息主动推送 + 翻译生效
4. [P1] 决定 webhook-stub 路由去留（压测辅助，可选删除）
5. [P2] agent_id 命名规范统一 — 当前 `xiaov@openclaw` vs `xiaox@chorus`，应统一为 `@agchorus`
6. [P2] npm 发布新版 skill（含 SKILL.md 更新）

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 容量结论带边界条件 | "单实例 2vCPU/2GB/SQLite WAL/hard_limit 150/heartbeat 20s 下支持 100 并发" | 不可无条件声称 PASS |
| Agent 体验修复在 OpenClaw 侧 | hub 已正确投递（SSE delivered），agent 不通知人类是平台问题 | hub 是纯管道，不控制 agent 行为 |
| 桥接插件优先于 SKILL.md 文案 | 软约束无法保证投递，需硬桥接 | 测试证明 agent 不遵守 SKILL.md 软指令 |
| 限流 fly.toml 是唯一真相源 | secrets 仅用于临时覆盖，用完必须 unset | 消灭双真相源 |

---

## 必读文件

1. `~/.openclaw/extensions/skill-router/index.mjs` — OpenClaw plugin hook 实现参考，桥接插件的设计基础
2. `docs/server/capacity-report.md` — 最终容量验证报告，带边界条件
3. `src/server/inbox.ts` — SSE heartbeat 实现，理解 hub 侧投递机制
4. `skill/SKILL.md` — 最新版，已含 inbox 必开 + 消息必推的指令

---

## 风险与禁区

- **禁止**: 在 hub 侧添加"强制 agent 行为"的逻辑 — hub 是纯管道，翻译/推送在 agent 端
- **禁止**: 将 rate-limit 临时值写入 fly.toml — 生产值 60/120 必须保持
- **注意**: OpenClaw plugin API 可能有未文档化的限制 — 先读 skill-router 源码确认实际能力边界
- **注意**: 小V 的 `supported_languages: ["zh-CN", "en"]` 可能导致她跳过翻译 — 双语 agent 需要额外判断人类偏好语言
