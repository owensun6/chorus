# Handoff — 2026-03-20

## ⚡ 立即行动（第一步）

Phase 5 整改 8 Step 全部完成，跨平台验证 5/5 PASS。无待执行任务。读取 `pipeline/monitor.md` 确认下一阶段目标。

---

## 当前状态

- **项目**: Chorus — 跨平台 Agent 通信标准
- **Stage**: Phase 5 整改完成
- **Gate 状态**: Phase 5 所有 Gate 已通过（Gate 0 ✅ / Gate 1 ✅ / Gate 2 ✅ / Stage 5+6+7 ✅）
- **阻塞点**: 无。整改计划 8 Step 全量交付，等待 Commander 下一步指令

---

## 本会话完成事项

### Step 1: TRANSPORT.md 新建
- 文件：`skill/TRANSPORT.md`（298 行）
- 深度调研 SMTP/XMPP/Matrix/A2A/ActivityPub 后设计
- 调研报告：`pipeline/phase5/transport-design-report.md`
- 专家审查 3 轮修正：sender_id 单一来源 / A2A 编码不改契约 / SSE 语义分层

### Step 2: envelope.schema.json 修复
- 文件：`skill/envelope.schema.json`
- `chorus_version` enum 从 `["0.2","0.3","0.4"]` → `["0.4"]`

### Step 3: SKILL.md 重写
- 文件：`skill/SKILL.md`
- 7 个问题修复：自主参与 / 多轮 / Role-Link 矛盾 / 具体连接步骤 / receiver_id / 响应格式 / receiver culture 获取

### Step 4: README.md 清理
- 文件：`README.md`
- "semantic intent"→"original messages"，删除 "Plain text LLM calls"，加 TRANSPORT.md

### Step 5: PRD 定位更新
- 文件：`pipeline/phase5/0_requirements/PRD.md`
- "跨文化语义适配协议与平台"→"跨平台 Agent 通信标准"

### Step 6: 中文翻译同步
- 文件：`skill/SKILL.zh-CN.md`（完整重译）
- PROTOCOL.zh-CN.md 已与英文版一致，无需改动

### Step 7: npm CLI 更新
- 文件：`packages/chorus-skill/cli.mjs` + `templates/shared/TRANSPORT.md`
- CLI init 输出 TRANSPORT.md，测试通过

### Step 8: 跨平台验证
- 5/5 PASS：同文化发送(含 transport) + 异文化发送 + 异文化接收 + Server 注册描述 + P2P 直连描述
- 验证 agent 反馈：三文档无矛盾，可独立学习

---

## 待完成（按优先级）

1. [P1] 提交所有修改到 git — 依赖：Commander 批准
2. [P1] 更新 `pipeline/monitor.md` 反映整改完成状态 — 依赖：Commander 确认
3. [P2] 参考实现对齐 TRANSPORT.md — `src/server/routes.ts` 的 `/messages` 端点当前用 `sender_agent_id`+`target_agent_id`+A2A message，标准定义 `receiver_id`+裸 envelope。不阻塞协议标准，参考实现可后续渐进对齐
4. [P2] `src/shared/types.ts` 中 `ChorusEnvelopeSchema` 仍用 v0.2/v0.3 字段（`original_semantic`），尚未更新到 v0.4。协议标准已正确，参考实现待后续对齐

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| TRANSPORT.md 定位 | 可选 L3 profile，非核心协议扩张 | PRD 约束：Chorus 不限制连接方式 |
| Send payload | 裸 envelope（MUST），A2A 包装（MAY alternate encoding） | 降低最小实现门槛 + 保持协议独立性 |
| sender_id 单一来源 | 只在 envelope 中，transport 不重复 | 避免 SMTP MAIL FROM/From: 不一致类安全问题 |
| receiver_id format | name@host canonical，本地短名 SHOULD accept | 与 sender_id 对称，为跨服务器路由预留 |
| 投递状态 | delivered / failed / rejected + 重试规则 | 专家指出"缺状态语义和幂等/重试"是最大缺口 |
| /.well-known/chorus.json | SHOULD，非 MUST | 行业最佳实践但不强制 |
| SSE streaming | MAY 扩展，是"内容流透传"非"投递进度" | 专家指出原版混淆了两种事件语义 |
| agent_card.chorus_version | "0.2"（extension 版本），独立于 envelope "0.4" | 两个版本号含义不同但同名，文档已注明 |
| envelope.schema.json enum | 只接受 "0.4" | v0.4 required 字段在旧版不存在，接受旧版本号 = 矛盾 |

---

## 必读文件

1. `skill/TRANSPORT.md` — L3 传输标准，本次核心新增
2. `skill/SKILL.md` — 重写后的 agent 学习文档
3. `skill/PROTOCOL.md` — L1 协议规范（未改动，但是基础）
4. `pipeline/phase5/transport-design-report.md` — 设计决策的调研依据
5. `memory-bank/architecture.md` — 架构决策记录

---

## 风险与禁区

- **禁止**: 在 TRANSPORT.md 中硬编码路径为协议要求 — 原因：行业主流是抽象操作+绑定分离
- **禁止**: 在 Send 请求中加外层 sender_id — 原因：已决策单一来源，在 envelope.sender_id
- **注意**: 参考实现 `src/` 尚未对齐 TRANSPORT.md 的新标准 — 这是预期的，标准先行，实现渐进跟进
- **注意**: agent_card.chorus_version("0.2") 和 envelope.chorus_version("0.4") 同名不同义 — 验证 agent 已标记为"最易混淆的点"，未来考虑改名
- **注意**: 跨服务器投递（federation）明确标为 out of scope — 验证 agent 发现了这个缺口但理解是预期的
