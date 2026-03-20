<!-- Author: PM -->
<!-- ⚠️ SUPERSEDED: 本文档已被 pipeline/PRD.md（统一 PRD v2.0）取代。保留为历史记录。 -->
<!-- status: APPROVED -->

# Chorus Protocol — Phase 1 PRD

project: Chorus Protocol
phase: 1
compiled_from: "Phase 0 实验结论 + Commander Phase 1 启动指令"
status: DRAFT

---

## 1. 业务背景

### Phase 0 回顾

Phase 0 验证了核心假设：在 Agent 间传递结构化文化元数据，显著提升跨文化沟通质量。

| 假设 | 结论 | 关键数据 |
|------|------|---------|
| A-05: 最小提示词元数据 | WEAK (4/10) | 仅 intent_type + formality 不够 |
| A-08: 结构化信封 + 文化背景 | **CONFIRMED (9/10)** | +1.0~1.4 分（5 分制），文化距离越大效果越强 |

**关键发现**: `cultural_context`（自然语言文化背景说明）是 A-08 效果的主要驱动力，但 Phase 0 的 Schema 中未定义此字段。

### Phase 1 目标

将 Phase 0 的"论文级验证"推进为"可运行的端到端系统"：两个 Agent 通过 Chorus 路由服务器，使用更新后的协议进行真实的跨文化对话。

### 三层架构（全景）

| 层 | 名称 | 许可证 | Phase 1 范围 |
|----|------|--------|-------------|
| L1 | Chorus Semantic Protocol v0.2 | Apache 2.0 | **更新交付** |
| L1.5 | Chorus Routing Server | Apache 2.0 | **新增交付** |
| L2 | The Idle Resort Engine | AGPL | 不涉及 |
| L3 | Cultural Adaptation Models | 商业 | 不涉及 |

---

## 2. 用例清单

### UC-01: 双人跨语言实时对话（Phase 1 核心）

一个中文母语用户和一个日文母语用户，各自启动 CLI Agent，通过 Chorus 路由服务器进行实时对话。

```
User A (中文 CLI)
    → Agent A: 理解意图 + 提取 cultural_context + 封装 Chorus Envelope v0.2
        → Chorus Routing Server: 查找 Agent B endpoint + 转发消息
            → Agent B: 解析信封 + 读取 cultural_context + 文化适配输出
                → User B (日文 CLI)
```

反向亦然。对话持续进行直到任一方退出。

### UC-02: Agent 注册与发现

Agent 启动时向 Chorus 路由服务器注册自身信息（endpoint、Agent Card 含 Chorus 扩展）。发起对话前，Agent 通过路由服务器发现对方 Agent 并确认 Chorus 协议兼容性和语言能力匹配。

### ~~UC-03: 协议降级~~ — Phase 1 不实现

> FP 删除：Phase 1 所有 Agent 均为 v0.2，无降级触发场景。Phase 2 引入第三方 Agent 时按需设计。

---

## 3. 非功能性需求

| 维度 | 要求 |
|------|------|
| 目标受众 | **内部验证** — 先跑通 demo，不做公开文档站 |
| 预估并发量 | 2 个 Agent 同时在线即可 |
| 延迟 | 单跳延迟 < 5 秒（从 Agent A 信封就绪 → Agent B 收到解析后的输出）。不含发送方 LLM 提取时间（用户可接受"思考中"等待）。分解：路由转发 ~50ms + 接收方 LLM 适配 ~2-4s = 2-4s，留 1s 余量 |
| 安全 | API Key 本地环境变量；路由服务器 HTTP（内网，不暴露公网）；无鉴权（内部 demo） |
| LLM 无关性 | 参考 Agent 使用 Dashscope（已验证可用），但协议不绑定任何 LLM |
| 持久化 | **无** — 路由服务器内存存储，重启即清空。Agent 注册信息不落盘 |
| 版本 | Chorus Envelope v0.2。v0.2 Schema 设置 `additionalProperties: true` 确保前向兼容。Phase 1 所有组件统一使用 v0.2 Schema |

---

## 3.5 Phase 1 不做清单 (Out of Scope)

| 不做 | 原因 |
|------|------|
| 文档站（Starlight/Astro） | 内部验证阶段，README 够用 |
| 鉴权/权限系统 | 内部 demo，无需 |
| 持久化存储 | 内存即可，demo 不需要恢复状态 |
| 多租户/多对话 | 一对一对话足够验证 |
| Web UI | CLI 交互，不做前端 |
| 自动化 CI/CD | 手动跑测试，内部验证 |
| 支持 v0.1→v0.2 在线迁移 | 直接用 v0.2 |
| 协议降级 (F8) | Phase 1 所有 Agent 均为 v0.2，无降级触发场景。Phase 2 按需设计 |
| 心跳/Keepalive | localhost demo 不需要。Agent 进程存在即在线，退出时显式注销 |

---

## 4. 假设登记表

| ID | 假设描述 | 影响(H/M/L) | 风险(H/M/L) | 验证方式 |
|----|---------|------------|------------|---------|
| A-P1-01 | Dashscope API 的 rate limit 在双 Agent 实时对话场景下够用（~2 req/10s） | H | M | D3 端到端测试 |
| A-P1-02 | LLM 能在单次调用中同时提取 semantic intent + 生成 cultural_context（无需两次调用） | M | L | Phase 0 的 agent.ts 已验证类似能力 |
| A-P1-03 | 单跳延迟（信封就绪 → 对方收到适配输出）< 5s | H | M | D2 路由服务器原型验证 |
| A-P1-04 | A2A DataPart 传输 Chorus Envelope 在实际 A2A SDK 中可行（Phase 0 仅手工构造 JSON） | H | H | Stage 1 架构阶段安排 spike 验证（在全量开发前单独测试 A2A SDK DataPart 行为）。**Fallback**: 若 SDK 不支持自定义 mediaType DataPart → 改为 raw HTTP + A2A-compliant JSON 手工构造（复用 Phase 0 方式），路由服务器仍可正常工作 |

---

## 5. 交付物清单

| 编号 | 交付物 | 说明 |
|------|--------|------|
| D1 | Chorus Protocol Spec v0.2 | 更新后的 JSON Schema + 提示词模板 |
| D2 | Chorus Routing Server | Agent 注册 + 发现 + 消息转发的轻量 HTTP 服务 |
| D3 | Reference Agent Pair | 中文 Agent + 日文 Agent CLI 实现，演示端到端流程 |

---

## 5.5 已知限制（Phase 1 不处理，Phase 2 考虑）

| 限制 | 说明 | 风险评估 |
|------|------|---------|
| 同时发言 | 两个用户同时输入时的行为未定义（Phase 1 采用交替对话模式） | 低 — 2 人 CLI demo 中自然交替 |
| 路由服务器宕机 | 对话过程中路由服务器崩溃，Agent 无法自动重连 | 低 — 内部 demo，手动重启即可 |
| Agent 重连 | Agent 断线后不会自动重新注册 | 低 — 手动重启 Agent |

---

## 6. Phase 1 成功标准

Phase 1 验收通过的条件（Commander 逐条确认）：

1. **端到端对话可运行**: 启动路由服务器 + 两个 Agent → 输入中文 → 对方看到日文（含文化适配）→ 反向亦然
2. **cultural_context 可见**: 对话过程中，信封内的 cultural_context 字段被填充且影响了输出质量
3. **延迟可接受**: 单跳延迟 < 5 秒
