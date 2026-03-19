# Handoff — 2026-03-19

## 立即行动（第一步）

读取 `pipeline/monitor.md` 确认状态。Phase 1+2 已合并到 main，所有 Gate 已通过。如有新需求 → 从 Stage 0 开始。如继续优化 → 直接在 main 上操作。

---

## 当前状态

- **项目**: Chorus Protocol — 跨文化 AI Agent 通信协议
- **Stage**: Phase 2 完成，无进行中的 Stage
- **Gate 状态**: 所有 Gate 已通过（Phase 1 Gate 0→3，Phase 2 Gate 0→2）
- **阻塞点**: 无

---

## 本会话完成事项

### Phase 1 (从 Gate 2 签字到 Stage 7 合并)
- Gate 2 签字 → 创建 worktree `feature/phase1-chorus-protocol`
- 8 个 Task TDD 完成（T-01~T-08），195 tests，92.5% coverage
- Commit: `c6e17a3`→`18f90e6`，merged to main
- E2E 验证: ja→zh-CN "つまらないものですが"→"一点心意，不成敬意，请您收下"
- FP 审计: 删除死代码（4 unused Schema + 3 types），修复 findChorusDataPart API 设计

### Phase 2 (完整 Stage 0→7)
- PRD: 3 功能（Streaming + Web Demo + 多轮上下文），11 子功能，22 BDD 场景
- 架构: HTTP chunked streaming, SSE, Demo 编排器（单进程）, 信封 v0.3
- 8 个 Task（T-01~T-08），255 tests
- Commit: `392a64c`→`6b4ebb3`，merged to main

### 后续优化（直接在 main 上）
- **模型切换**: `qwen3.5-plus`→`qwen3-coder-next`（80x 提速）→ commit `4e6eace`
- **FP 审计第 3 轮**: llm.ts 重复消除，index.ts 拆分，demo 假广播修复 → commit `b78f7ab`
- **纯文本 LLM**: JSON 提取→2 次纯文本调用（消除 ja 方向 100% 格式失败）→ commit `7f66a32`
- **Agent 人格**: 透明翻译→文化朋友传话 → commit `e7c2c3f`

---

## 待完成（按优先级）

1. [P1] Web UI 浏览器实测（Playwright）— 依赖: 无，可立即执行
2. [P1] 更多语言对测试（en, ko, ar）— 依赖: 无
3. [P2] Agent Card 人格描述字段（让用户自定义风格）— 需 PRD
4. [P2] 公网部署方案 — 需架构决策（HTTPS, 鉴权）
5. [P3] 翻译质量自动评估（LLM-as-judge）— Phase 0 已有基础

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| LLM 不输出 JSON | 2 次纯文本调用替代 1 次 JSON 调用 | JSON 在日文输入时 100% 失败 |
| 删除 intent_type/formality/emotional_tone | ExtractResult 只保留 semantic + cultural_context | 3 个字段从未参与适配逻辑 |
| Agent 有人格 | 提示词让 Agent 以朋友身份传话 | 不定义人格参数，LLM 自带 |
| qwen3-coder-next | coding.dashscope 端点最快模型（1.4s, 0 thinking） | 8 模型横评结论 |
| 120s 转发超时 | routes.ts TIMEOUT_MS | LLM 适配可能需要数秒 |

---

## 必读文件

1. `pipeline/monitor.md` — 全局进度看板（Phase 0+1+2 状态）
2. `src/agent/llm.ts` — LLM 核心逻辑（纯文本调用 + 人格提示词）
3. `src/demo/index.ts` — Demo 编排器入口（一键启动 4 服务）
4. `memory-bank/architecture.md` — 架构决策全记录

---

## 风险与禁区

- **禁止**: 要求 LLM 输出 JSON — 原因: ja/非英文输入时格式失败率极高，已验证
- **禁止**: 使用 qwen3.5-plus/glm-5/glm-4.7 做实时对话 — 原因: thinking 模型 20-30s 延迟，无法禁用
- **注意**: `coding.dashscope.aliyuncs.com` 的 `sk-sp-` key 只支持有限模型 — 正确判断: 逐个 curl 测试，不要猜
- **注意**: E2E smoke test 在 `tests/e2e/smoke.ts`，端口 4000-4002 — 运行前先 `lsof -ti:4000,4001,4002 | xargs kill`
