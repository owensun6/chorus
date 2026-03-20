# Handoff — 2026-03-19 Phase 5 SKILL Redesign

## 立即行动

1. 读取 `pipeline/monitor.md` 确认状态：Phase 5 Stage 5 开发执行中
2. 读取本文件恢复上下文
3. 继续执行 task.md 中的待完成任务
4. 所有 Gate 自行审批（Commander 授权）

---

## 当前状态

- **Phase 5 Stage 5** — 开发执行中
- **T-01 PROTOCOL.md (en)** — ✅ 已完成（skill/PROTOCOL.md, 71 行, v0.4）
- **T-02 PROTOCOL.md (zh-CN)** — 待完成
- **T-03 SKILL.md (en)** — 待完成（最重要的任务）
- **T-04 SKILL.md (zh-CN)** — 待完成
- **T-05 同文化示例** — 待完成
- **T-06 npm CLI 包** — 待完成
- **T-07 跨平台验证** — 待完成
- **T-08 README + L3 标注** — 部分完成（README 需要更新）

---

## 本轮关键决策（必须遵守）

### 协议升维（与 Commander 头脑风暴确认）

1. **Chorus = Link**（一个动词）。跨平台 Agent 通信标准。不是翻译工具。
2. **跨平台互通是核心**，文化适配是锦上添花。同文化 Agent 也用 Chorus 互通。
3. **cultural_context 对话首轮声明一次**，后续轮次不重复，同文化省略。
4. **Protocol ≠ Skill**：PROTOCOL.md（L1 规范）+ SKILL.md（L2 教学）物理分离。
5. **original_text 替代 original_semantic**（v0.4 breaking change）。不需要"语义提取"步骤。
6. **sender_id 格式 name@host**——像 email 地址，host 保证唯一性。
7. **Response 格式 + 3 个错误码**：INVALID_ENVELOPE, UNSUPPORTED_VERSION, ADAPTATION_FAILED。
8. **Agent IS the LLM**——不是"调用 LLM 的程序"。Skill 是在和智能体说话，不是写 API 文档。
9. **Agent-to-Agent 通信 ≠ Agent-to-Human 通信**。Agent↔Human 已解决（OpenClaw channels），Chorus 解决 Agent↔Agent。
10. **终极愿景**：所有人通过自己的 Agent 互通，无平台/语言/文化隔阂。Agent 社交网络是远期方向。

### SKILL.md 设计（头脑风暴确认）

- **受众是智能体本身**，不是程序员。和 AI 说话，不是写调用文档。
- **不需要提示词模板**——Agent 就是 LLM，不需要教它"提示自己"。
- **必须包含 L3 实现细节**——怎么实际连接其他 Agent（Chorus Server / P2P）。
- **结构**：
  1. What is Chorus
  2. Your Role（协议参与者）
  3. Sending（打包 Envelope）
  4. Receiving（适配/转达）
  5. How to Link（L3 实现：Server 注册 / P2P 直连）
  6. DO NOT（反模式）
  7. Envelope Reference（引用 PROTOCOL.md）
- **双语**：en + zh-CN，最后统一翻译。
- **YAML frontmatter**：name, description, version（借鉴 OpenClaw/EvoMap）。

### 竞品研究结论

- **SMTP**（横向对标）：一个动词(Transfer)、信封/内容分离、极简核心、"few options tend towards ubiquity"。
- **A2A/MCP/ACP/ActivityPub**（纵向对标）：都是万行级规范。Chorus 故意只有 71 行——不定义传输/发现/认证。
- **EvoMap**：YAML frontmatter、MUST/NEVER 语气、反模式区域、双语。
- **OpenClaw/Moltbook**：SKILL.md 30-80 行目标、description 是触发器、progressive disclosure。

### L3 三种场景

1. **Chorus Server**（局域网/受限网络）——Agent IM 中继，参考实现已在 src/server/
2. **P2P 直连**——两人交换 agent_id，Agent 直接通信
3. **Agent 社交网络**——远期愿景，Agent 自主发现和社交

---

## 必读文件

1. `skill/PROTOCOL.md` — 当前协议定稿（v0.4, 71 行）
2. `skill/SKILL.old.md` — 旧版 Skill（已归档，对比用）
3. `skill/envelope.schema.json` — 需更新（加 sender_id, original_text 替代 original_semantic）
4. `pipeline/phase5/1_architecture/2026-03-19-skill-redesign.md` — 头脑风暴设计方案
5. `pipeline/phase5/2_planning/task.md` — 8 个任务清单
6. `pipeline/phase5/0_requirements/PRD.md` — 统一 PRD v2.0（需更新定位为"跨平台通信标准"）

---

## 风险与禁区

- **禁止**：把 Skill 写成 API 调用文档或提示词模板集。Agent IS the LLM。
- **禁止**：在 PROTOCOL.md 加实现细节。协议只管信封格式和规则。
- **禁止**：假设 Agent 都是聪明的。笨 Agent 可能直接把日文转给中国人——所以 Receiving 规则"MUST deliver in a form the receiver can understand"要保留。
- **注意**：envelope.schema.json 还没更新（仍是旧版 v0.3 schema），需要同步更新。
- **注意**：PRD 定位还写着"跨文化语义适配协议"，需更新为"跨平台 Agent 通信标准"。
