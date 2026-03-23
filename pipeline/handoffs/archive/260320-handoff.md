# Handoff — 2026-03-20

## ⚡ 立即行动（第一步）

运行 `npm test` 确认 141 tests 全绿无警告。然后读 `docs/experiment-results/EXP-01-summary.md` 了解上次实验结果，开始设计 EXP-02（将"受控外部 Agent"推进到更弱约束环境）。

---

## 当前状态

- **项目**: Chorus Protocol — 跨平台 Agent 通信标准
- **Stage**: Phase 6 完成，EXP-01 完成，待 Commander 指令启动 EXP-02
- **Gate 状态**: 无活跃 Gate — 当前处于实验验证阶段（非 Fusion 流水线内）
- **阻塞点**: 无技术阻塞。下一步方向待 Commander 决策

---

## 本会话完成事项

### 1. 状态报告 v1→v2 重写（4 轮 Commander 审计）
- `docs/status-report-2026-03-20.md` — 从"工作总结"改为"可决策文档"
- 删除自评分，增加证据索引表（12/12 路径验证通过），结论收紧为 3 句话：
  - 技术可用已初步验证
  - 采纳价值尚未验证
  - 外部接入仍有信任边界未封口
- 身份边界分层澄清：L1/L2 永远不管 auth，L3 可定义可选 auth profile

### 2. EXP-01 外部集成实验规格 + 执行
- `docs/experiment-external-integration.md` — 实验规格（5 轮 Commander 审计）
- `docs/experiment-results/EXP-01-summary.md` — 结果总结
- `docs/experiment-results/EXP-01-friction-log.md` — 采用摩擦日志
- `docs/experiment-results/EXP-01-envelope.json` — 外部 Claude 生成的 Envelope
- `docs/experiment-results/EXP-01-server-log.txt` — 服务器请求/响应日志
- `docs/experiment-results/EXP-01-agent-log.txt` — zh-CN Agent 终端日志
- **EXP-01 结论**: 受控环境下，SKILL.md + 最小任务提示可支持高能力外部 Agent 完成首次接入。不能外推到真实第三方开发者。

### 3. SKILL.md 文档缺陷修复
- `skill/SKILL.md:32` — Sending 章节增加 `chorus_version: "0.4"` 为必填字段（EXP-01 发现的遗漏）

### 4. jest 泄漏根因修复
- `src/server/routes.ts` — 两处 AbortController 120s timeout 的 clearTimeout 从 try 内移至 finally 块
- `tests/agent/index.test.ts` — `jest.spyOn(global, "fetch")` → 模块级 `global.fetch = jest.fn()`
- `tests/agent/discovery.test.ts` — 同上
- `tests/server/messages.test.ts` — 同上
- 结果：141 tests, 82.56% coverage, 干净退出无任何警告

---

## 待完成（按优先级）

1. [P0] **提交本次所有改动** — 依赖：Commander 审批。当前 working tree 有未提交改动（status report v2 + EXP-01 产物 + SKILL.md 修复 + jest 泄漏修复 + test file 改动）
2. [P1] **设计 EXP-02** — 从"受控外部 Claude"推进到更弱约束环境。待 Commander 定义目标（真实第三方开发者？更弱 LLM？不同平台？）
3. [P2] **SKILL.md chorus_version 遗漏在 SKILL.zh-CN.md 也需同步修复** — 中文版可能有同样遗漏
4. [P2] **demo agent ID 短名与协议 name@host 不一致** — `src/demo/index.ts:66` 用 `agent-zh-cn`（无 @host），非阻断但影响参考实现一致性

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 身份边界分层 | L1/L2 永远不管 auth。L3 TRANSPORT.md 可定义可选 auth profile，但 Chorus 不运营 PKI/CA | 消除 v1 中"可能加签名"与"不建设认证"的矛盾 |
| EXP-01 结论边界 | 只能说"受控环境下技术可达性已验证"，不能说"协议采纳可行"或"文化适配有效=协议增益" | 文化适配含 personality prompt 贡献；受控环境≠真实采纳 |
| jest 泄漏修复方式 | 必须消除根因（clearTimeout finally），不接受 forceExit | Commander 明确要求：绕过不等于修复 |
| 状态报告不写自评分 | 无基线、无外部对照的评分制造确定性幻觉 | Commander 审计判定 |

---

## 必读文件

1. `docs/status-report-2026-03-20.md` — 项目决策文档（已审通过的 v2）
2. `docs/experiment-results/EXP-01-summary.md` — 实验结论 + 局限性
3. `docs/experiment-external-integration.md` — 实验规格（可复用为 EXP-02 模板）
4. `skill/SKILL.md` — 协议 Skill 文档（已修复 chorus_version 遗漏）
5. `skill/PROTOCOL.md` — 71 行协议规范

---

## 风险与禁区

- **禁止**: 在状态报告中写无基线的自评分 — Commander 已明确拒绝
- **禁止**: 用 `jest.spyOn(global, "fetch")` — Node.js 25 的 undici 会留下连接池 timer
- **禁止**: 把 `forceExit: true` 作为测试泄漏的修复方案
- **注意**: POST /messages 返回 `data.delivery`（非 `data.status`）— 已踩过这个坑
- **注意**: receiver 非流式只返回 `{ status: "ok" }`，不返回回复 Envelope — adapted text 仅在 Agent 日志中可见
- **注意**: 外部 Agent 必须先 POST /agents 注册才能发消息 — 否则 ERR_SENDER_NOT_REGISTERED
