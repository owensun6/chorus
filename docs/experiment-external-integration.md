# EXP-01: 最小外部集成实验

2026-03-20 | 状态：待 Commander 审批

---

## 0. 目的

验证假设 H-1：是否存在外部 Agent 愿意且能够通过阅读 SKILL.md 接入 Chorus 网络。

本实验不验证协议的商业价值，只验证技术可达性 + 采用摩擦。

---

## 1. 目标对象

**选定**：一个运行在 Claude Code 中的 Claude 实例（非本项目会话）。

**选择理由**：
- 我们能控制实验环境，排除外部依赖
- Claude 有足够的 LLM 能力生成 cultural_context
- 模拟"外部开发者第一次接触 Chorus"的真实路径

**排除的选项**：
- GPT 实例：需要额外的 API 配置，增加实验变量
- 真实第三方开发者：当前无社区，无法招募
- 自动化脚本：不能验证"Agent 理解 SKILL.md"的能力

---

## 2. 接入模式

**模式**：Chorus Server（非 P2P）。

**理由**：
- Server 模式下 sender_id 由服务器控制注册，规避 H-2 身份信任问题
- 参考实现已有可用的路由服务器
- P2P 模式的信任问题尚未解决，不应在本实验中引入

**拓扑**：

```
[claude-en@localhost]  ──POST /messages──>  [Chorus Router :3000]  ──forward──>  [agent-zh-cn]
       (en)                                                                        (zh-CN)
```

**地址约定**：
- 外部 Agent sender_id：`claude-en@localhost`（符合 `name@host` 格式，`src/shared/types.ts:14`）
- 目标 Agent receiver_id：`agent-zh-cn`（demo 注册的短名，`src/demo/index.ts:66`）
- HTTP 端点：`http://localhost:3000`（传输层地址，不是 sender_id 的一部分）

**接口契约**：

| 操作 | 方法 | 端点 | Body 必填字段 | 证据 |
|------|------|------|-------------|------|
| 注册 | POST | `/agents` | `agent_id`, `endpoint`, `agent_card` | `src/server/validation.ts:5-9`, `skill/TRANSPORT.md:50-59` |
| 发送 | POST | `/messages` | `receiver_id`, `envelope` | `src/server/validation.ts:13-17`, `skill/TRANSPORT.md:80-90` |
| 查询 | GET | `/agents` | — | `src/server/routes.ts:35-38` |

**服务端强制约束**：`envelope.sender_id` 必须是已注册的 agent_id，否则返回 `ERR_SENDER_NOT_REGISTERED`（`src/server/routes.ts:82-87`）。

---

## 3. 实验步骤（原子化）

### Step 1: 启动 Chorus Server + zh-CN Agent

- 前置：`npm run build`（编译 TypeScript）
- 命令：`node dist/server/index.js`（启动路由服务器，默认 :3000）
- 命令：`node dist/demo/index.js`（启动 demo agents，注册 `agent-zh-cn` 和 `agent-ja`）
- 验证：`curl http://localhost:3000/agents` 返回已注册 agent 列表，包含 `agent-zh-cn`
- 产物：终端日志截图
- 注意：package.json 无 `demo` script，必须手动启动编译产物

### Step 2: 注册外部 Agent

外部 Claude Agent 必须先注册到 Server，否则 POST /messages 会返回 ERR_SENDER_NOT_REGISTERED。

- 动作：执行以下 curl 命令注册外部 sender

```bash
curl -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "claude-en@localhost",
    "endpoint": "http://localhost:4000/receive",
    "agent_card": {
      "chorus_version": "0.2",
      "user_culture": "en",
      "supported_languages": ["en"]
    }
  }'
```

- 验证：HTTP 201 + response body 包含 `registered_at` 时间戳
- 验证：`curl http://localhost:3000/agents` 列表中出现 `claude-en@localhost`
- 注意：`endpoint` 字段是 Agent 接收消息的回调 URL。本实验中外部 Claude 不需要真正监听此端口（单向发送），但 schema 要求必填（`src/server/validation.ts:7`）
- 产物：注册请求/响应日志

### Step 3: 向外部 Claude 提供 SKILL.md

- 动作：在一个独立的 Claude Code 会话中，让 Claude 阅读 `skill/SKILL.md`（96 行）
- 指令：

> 你是一个英语 Agent，sender_id 为 `claude-en@localhost`。
> 阅读这份 Chorus Skill 文档。
> 然后构造一个合法的 Chorus Envelope，包含一条涉及文化禁忌的英文消息（例如关于送礼或餐桌礼仪的话题）。
> 用 curl 将消息发送到 Chorus Server，格式如下：
>
> ```
> POST http://localhost:3000/messages
> Content-Type: application/json
> Body: { "receiver_id": "agent-zh-cn", "envelope": { ...your envelope... } }
> ```

- 验证：Claude 是否能独立构造合法 Envelope（无需额外指导）
- 产物：Claude 生成的 Envelope JSON

### Step 4: 发送消息

- 动作：外部 Claude 执行其构造的 curl 命令，向 `POST http://localhost:3000/messages` 发送 JSON body，包含 `receiver_id: "agent-zh-cn"` 和 `envelope` 对象
- 参考格式（由 Claude 独立生成，此处仅作校验基准）：

```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "agent-zh-cn",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "claude-en@localhost",
      "original_text": "I was thinking of bringing a clock as a gift for our Chinese partner.",
      "sender_culture": "en",
      "cultural_context": "In Western culture, clocks are common practical gifts..."
    }
  }'
```

- 验证：HTTP 200 + `response.data.delivery === "delivered"`（`src/server/routes.ts:128`，测试断言 `tests/server/messages.test.ts:76`）
- 验证：`response.data.receiver_response` 包含 `{ status: "ok" }`（receiver 非流式响应，`src/agent/receiver.ts:86`）
- 产物：请求/响应日志

### Step 5: 验证 zh-CN Agent 接收与适配

- 验证：zh-CN Agent 的 `onMessage` 回调被触发，终端日志中可见 adapted text（`src/agent/receiver.ts:84`）
- 验证：adapted text 为中文，内容体现了对原始消息的文化适配（如对送钟禁忌的提示）
- 产物：zh-CN Agent 终端日志截图（含 original_text + adapted text）
- 注意：当前实现中 receiver 非流式响应仅返回 `{ status: "ok" }`，不返回回复 Envelope。adapted text 仅出现在 Agent 侧日志中，不在 HTTP 响应链路内

### Step 6: 记录采用摩擦

- 记录：外部 Claude 从阅读 SKILL.md 到成功发送的总耗时
- 记录：过程中是否需要额外解释或纠正
- 记录：Claude 对 SKILL.md 的理解偏差（如果有）
- 记录：Claude 是否自主完成了注册步骤（还是需要提示）
- 记录：外部 Envelope 中 cultural_context 的质量（是否有意义地描述了文化背景）
- 产物：`docs/experiment-results/EXP-01-friction-log.md`

---

## 4. 成功标准

实验成功当且仅当以下全部满足：

| # | 标准 | 判定方式 |
|---|------|---------|
| S-0 | 外部 sender 注册成功 | POST /agents 返回 201 + `registered_at` 非空 |
| S-1 | 外部 Claude 仅凭 SKILL.md 独立生成合法 Envelope | Envelope 通过 `envelope.schema.json` 校验 |
| S-2 | 消息成功送达 zh-CN Agent | POST /messages 返回 200 + `data.delivery === "delivered"` + `data.receiver_response.status === "ok"` |
| S-3 | zh-CN Agent 产出有效的文化适配文本 | Agent 终端日志中 `onMessage` 输出的 adapted text 为中文，体现文化适配 |
| S-4 | 全程无需人工修正 Envelope 格式 | friction log 中无格式纠正记录 |

---

## 5. 失败条件与止损

| 失败场景 | 判定 | 后续动作 |
|---------|------|---------|
| 外部 sender 注册失败 | S-0 FAIL | 检查 validation schema 与 TRANSPORT.md 是否一致 → 修复 |
| Claude 无法理解 SKILL.md，生成无效 Envelope | S-1 FAIL | 记录理解偏差 → 修订 SKILL.md → 重试一次 |
| Envelope 合法但服务器拒绝（如 ERR_SENDER_NOT_REGISTERED） | S-2 FAIL | 检查注册状态是否存活 → 重新注册 → 重试 |
| 消息送达但 zh-CN Agent 日志无 adapted text 输出 | S-3 FAIL | 检查 `adaptMessage()` 调用链（`src/agent/receiver.ts:77` → `src/agent/llm.ts`） |
| 需要人工修正 Envelope 格式 | S-4 FAIL | 记录修正内容 → 评估 SKILL.md 是否需要补充说明 |
| 重试一次后仍为 FAIL | 实验失败 | 写结论报告，暂停外部集成方向 |

---

## 6. 产物路径

| 产物 | 路径 |
|------|------|
| 实验结果总结 | `docs/experiment-results/EXP-01-summary.md` |
| 采用摩擦日志 | `docs/experiment-results/EXP-01-friction-log.md` |
| 外部 Claude 生成的 Envelope | `docs/experiment-results/EXP-01-envelope.json` |
| 服务器日志 | `docs/experiment-results/EXP-01-server-log.txt` |
| zh-CN Agent 终端日志 | `docs/experiment-results/EXP-01-agent-log.txt` |

---

## 7. 前置条件

- [ ] `npm run build` 成功（tsc 零错误）
- [ ] `npm test` 全绿（141 tests passed）
- [ ] `DASHSCOPE_API_KEY` 环境变量已配置（zh-CN Agent 需要 LLM 生成 cultural_context）
- [ ] 一个独立的 Claude Code 会话可用（用于模拟外部 Agent）

---

## 8. 不在本实验范围内

- P2P 模式测试（信任边界未解决）
- 多轮对话验证
- 多语言对验证（本次仅 en ↔ zh-CN）
- 性能基准测试
- npm 包发布
- 外部 Agent 的 receive endpoint 真实监听（本实验仅验证单向发送 + server 转发）
