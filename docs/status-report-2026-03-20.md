# Chorus Protocol — 项目决策文档

2026-03-20 | Phase 0→6 完成 | v2

---

## 一、已验证事实

以下每项结论附有可独立复验的证据路径。

### 1.1 协议架构已定稿

Chorus 是一个 Agent 间跨平台通信标准，三层架构：

| 层 | 文件 | 行数 | 职责 |
|----|------|------|------|
| L1 Protocol | `skill/PROTOCOL.md` | 71 | 信封格式 + 通信规则 |
| L2 Skill | `skill/SKILL.md` | 96 | 教任意 Agent 使用协议 |
| L3 Transport | `skill/TRANSPORT.md` | 297 | HTTP 传输绑定（可替换） |
| L3 参考实现 | `src/` | 1,558 | TypeScript 路由服务器 + Agent + Web Demo |

Envelope 含 7 字段：chorus_version, sender_id, original_text, sender_culture, cultural_context, conversation_id, turn_number。JSON schema: `skill/envelope.schema.json`。

### 1.2 测试通过，覆盖率达标

| 指标 | 数值 | 验证方式 |
|------|------|---------|
| 测试数 | 141 | `npm test` |
| 行覆盖率 | 82.56% (450/545) | `npm run test:coverage` → `coverage/lcov-report/index.html` |
| 语句覆盖率 | 81.51% (485/595) | 同上 |
| 函数覆盖率 | 80.61% (79/98) | 同上 |
| 分支覆盖率 | 84.65% (149/176) | 同上 |
| 覆盖率门槛 | 80% 全维度 | `jest.config.js:5` — 低于阈值 jest 报错 |
| TypeScript | 零编译错误 | `npx tsc --noEmit` |

**注意**：v1 报告写 82.82%，实际为 82.56%。已纠正。

### 1.3 cultural_context 是核心增值

Phase 0 对照实验证明 cultural_context 字段的增值：

| 实验 | 结论 | 评分 | 证据路径 |
|------|------|------|---------|
| A-05 Prompt 有效性 | CONFIRMED | 文化适切度 3.00→4.00 (+1.00) | `docs/archive/2026-03-17-spike-experiment-report.md:13` |
| A-08 结构化字段增值 | CONFIRMED | 文化适切度 4.00→4.80 (+0.80) | `docs/archive/2026-03-17-spike-experiment-report.md:14` |

实验方法：10 个测试用例（5 文化禁忌 + 5 俚语），三组对照（A 直接翻译 / B 最小+提示 / C 完整+提示），Claude Sonnet 作为 LLM-as-Judge。

文化距离越大，增值越高（zh-ar +2.25 vs zh-ko +0.60）。

### 1.4 关键架构转向（已固化）

| 决策 | 证据 | 不可逆原因 |
|------|------|-----------|
| 纯文本 LLM 调用替代 JSON 结构化输出 | commit `7f66a32` | 消除 ja 方向 100% 格式失败率 |
| A2A 包装层完全移除，裸 envelope 传输 | commit `46cbfbb` | 减少协议层级，已删除相关类型 |
| `original_semantic` → `original_text` | `PROTOCOL.md:71` | Agent IS the LLM，语义提取步骤冗余 |
| 从"需要 Router 的基础设施"变为"Skill" | commit `67ab683` | 12+ 协议对标后确认无竞品覆盖此层 |

### 1.5 证据索引表

| 关键数字 | 值 | 验证命令或路径 |
|---------|-----|--------------|
| 141 tests 全绿 | 141 passed | `npm test` |
| 覆盖率 82.56% | lines 82.56% | `npm run test:coverage` → `coverage/lcov-report/index.html` |
| LLM 调用次数 | 1 次/消息 | `src/agent/index.ts:80` 调用 `generateCulturalContext()`，实现在 `src/agent/llm.ts:89` — 整条路径仅此一处 LLM 调用 |
| 延迟 1.4s/msg | qwen3-coder-next | commit `4e6eace` (从 30s 降至 0.7s/call) |
| 跨平台 5/5 PASS | 5 个 fresh Agent 独立生成合法 Envelope | **无独立测试文件**——仅记录于 v1 报告。此项证据强度不足 |
| npm CLI | `@chorus-protocol/skill` v0.4.0 | `packages/chorus-skill/package.json` — 未发布到 npm |
| Dockerfile | 就绪 | `Dockerfile` — node:22-alpine, port 3000 |
| CI pipeline | **不存在** | 无 `.github/workflows/` 目录 |
| 42 commits | Phase 0→6 | `git log --oneline` |

---

## 二、未验证假设

以下为项目继续推进前必须面对的开放假设，按阻断程度排序。

### H-1: 协议采纳假设（CRITICAL — 价值真理）

**假设**：存在外部 Agent 愿意承担阅读 SKILL.md + 修改代码的成本来接入 Chorus。

**现状**：零外部采纳。跨平台验证（5/5）是我们自己用 fresh Agent 做的，不等于真实开发者愿意采用。

**未验证的子假设**：
- 目标用户是谁（Agent 开发者？平台方？个人开发者？）
- 采用成本是否可接受（读 96 行 SKILL.md 是否足够？需要额外代码量多少？）
- 激励机制是什么（为什么不直接翻译？Chorus 的增值在用户视角是否可感知？）

### H-2: 身份信任假设（HIGH — 外部接入前置条件）

**假设**：sender_id `name@host` 足以标识发信方身份。

**现状**：

- L1 PROTOCOL.md 明确将 Authentication 排除在范围外（`skill/PROTOCOL.md:65`）
- L3 TRANSPORT.md 说"use whatever your deployment requires"（`skill/TRANSPORT.md:293`）
- P2P 模式下，任何 Agent 可声称任意 `name@host`，协议层无防御
- Chorus Server 模式下由服务器控制注册，信任由服务器保证

**决策边界（需 Commander 裁定）**：

Chorus 协议（L1+L2）永远不管身份验证——这是明确的设计选择，与 SMTP 对等。
但如果推进外部接入，L3 传输层需要回答：是否定义一个可选的 `signed-envelope` transport profile？

当前答案空白。v1 中"可能需要签名机制"与"不要建设认证基础设施"的矛盾，根源在于没有区分 L1 决策和 L3 决策。

**澄清后的立场**：
- L1/L2：Auth 永远 Not In Scope。不矛盾。
- L3：TRANSPORT.md 可以定义可选 auth profile（如 HTTP Signature header），但 Chorus 不运营任何 PKI/CA。
- 这不是"两边都沾"，是分层归属不同。

### H-3: cultural_context 质量假设（HIGH — 核心增值依赖）

**假设**：Agent 的 LLM 能力足以生成有用的 cultural_context。

**现状**：
- 参考实现用 qwen3-coder-next，质量可接受但不稳定
- 无 LLM 能力的 Agent 只能省略 cultural_context，此时 Chorus 退化为普通消息传递
- 协议不管内容质量（设计选择），但这意味着用户体验取决于最弱的参与者

**无法现阶段验证**。需要在多种 LLM 后端下观察真实 cultural_context 质量分布。

### H-4: demo 一致性（MEDIUM）

- ~~demo 层 agent ID 用短名（无 @host）~~ — 已修复，demo 现使用 `agent-zh-cn@localhost` / `agent-ja@localhost`
- `skill/SKILL.old.md` 残留未删除
- E2E 测试需要 `DASHSCOPE_API_KEY`，CI 无法自动运行（且 CI pipeline 本身不存在）

---

## 三、结论

1. **技术可用已初步验证**。协议定稿，参考实现通过 141 tests / 82.56% coverage / tsc 零错误。
2. **采纳价值尚未验证**。零外部用户，无采纳成本数据，无激励分析。
3. **外部接入仍有信任边界未封口**。L3 层缺少可选 auth profile 定义，P2P 场景下 sender_id 不可信。

**决策问题**：是否投入资源执行一次最小外部集成实验来验证 H-1？

实验规格见 `docs/experiment-external-integration.md`。

---

## 附录：与 v1 的差异

| 项目 | v1 值 | v2 修正 | 原因 |
|------|-------|---------|------|
| 覆盖率 | 82.82% | 82.56% | v1 为近似值，v2 从 `coverage/lcov-report/index.html` 取实际值 |
| CI | 未提及 | 标注不存在 | `.github/workflows/` 目录不存在 |
| 跨平台验证 | "5/5 PASS" | 标注证据强度不足 | 无独立测试文件，仅自述 |
| 自评分 | 9/10, 8/10... | 已删除 | 无基线、无评分方法、无外部对照 |
| 身份边界 | 自相矛盾 | 分层澄清 | L1 不管 auth，L3 可定义 optional profile |
