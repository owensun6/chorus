<!-- Author: Lead -->

# Phase 5 差距分析 + 验证方案

## 目的

回答一个问题：从现状到 Phase 5 交付，还差什么？

---

## 现状评估

### skill/ 目录 vs BDD 验收标准

| F-ID | 交付物 | BDD 验证结果 | 差距 |
|------|--------|-------------|------|
| F5.1 | SKILL.md | ✅ 全部 PASS | **无差距** — 发送/接收教学完整，提示词与代码精确匹配，无禁止关键词 |
| F5.2 | envelope.schema.json | ✅ 全部 PASS | **无差距** — 必填字段、BCP47 pattern、additionalProperties:true、与 PRD 一致 |
| F5.3 | examples/ | ✅ 全部 PASS | **无差距** — zh-CN⟷ja 双向，完整 Envelope+适配输出，cultural_context 10-500 字 |
| F5.4 | 跨平台验证 | ❌ 未执行 | **需要执行** — 用 fresh Agent 验证 |
| F5.5 | 参考实现重定位 | ❌ 未执行 | **需要执行** — src/ 文件头 + 项目 README 标注 |

### 结论

**D1 Skill 文件包 (P0) 已完成。** 现有 skill/ 目录的 4 个文件全部通过 BDD 验收。

**剩余工作仅 D2 + D3 (P1)。**

---

## D2 跨平台验证方案 (F5.4)

### 验证方法

1. 启动一个全新的 Claude Code agent（无 Chorus 项目上下文）
2. 仅向该 Agent 提供 `skill/SKILL.md` 文件内容
3. 测试发送：给定用户输入，要求 Agent 输出 Chorus Envelope
4. 测试接收：给定 Envelope，要求 Agent 做文化适配

### 验收标准

| 测试项 | 通过条件 |
|--------|---------|
| Envelope 合法性 | 通过 envelope.schema.json 验证 |
| 包含 cultural_context | 非空，10-500 字 |
| 接收适配语言正确 | 仅使用 receiver_culture 语言 |
| 适配质量 | 保留原文意图，体现文化差异理解 |

### 执行方式

用 Claude Code Agent tool 启动隔离子 Agent，传入 SKILL.md 内容作为 system prompt，模拟"从未见过 Chorus 的 Agent"。

---

## D3 参考实现重定位方案 (F5.5)

### 需标注的文件

| 文件 | 标注方式 |
|------|---------|
| `src/server/index.ts` | 文件头注释 |
| `src/agent/index.ts` | 文件头注释 |
| `src/demo/index.ts` | 文件头注释 |
| 项目根 `README.md`（如不存在则创建） | 专门章节说明 L1/L2/L3 层次 |

### 标注内容模板

```typescript
// L3 Reference Implementation — This is an optional reference implementation
// of the Chorus ecosystem layer. Using Chorus protocol does NOT require this code.
// The protocol is defined in skill/SKILL.md and skill/envelope.schema.json.
```

---

## 架构决策

Stage 2（头脑风暴）**建议 SKIP**：D2/D3 均为明确执行任务，无设计歧义，无需多方案权衡。

---

## 假设

| ID | 假设 | 影响 | 风险 | 验证方式 |
|----|------|------|------|---------|
| A-S1-01 | SKILL.md 提示词在非 Qwen LLM 上行为一致 | H | M | D2 跨平台验证 |
| A-S1-02 | 现有 skill/ 草稿质量足够 | M | L | 已验证 ✅ — BDD 全 PASS |
