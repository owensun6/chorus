---
name: fusion-compile-req
description: PM 需求快速编译。需求清晰时一步直出 PRD + FEATURE_LIST + BDD。
---

# fusion-compile-req — 需求快速编译器


---

## ⚡ 执行前 FP 两问（强制，不可跳过）

1. **我们的目的是什么？**
   → 编译需求为 PRD+BDD
2. **这些步骤已经不可原子级再分了吗？**
   → 三份文档必须顺序产出（PRD → FEATURE_LIST → BDD），不可并联、不可跳步。

---

## 触发条件

| 情境                                     | 触发                          |
| ---------------------------------------- | ----------------------------- |
| `fusion-pm-interview` 完成，需求无歧义   | ✅ 自动衔接                   |
| Commander 明确表示"需求很清楚，直接编译" | ✅ 直接触发                   |
| 需求存在未消歧的模糊项                   | ❌ 退回 `fusion-pm-interview` |

---

## 决策依据来源（优先级顺序）

编译过程中遇到不确定项，按以下优先级自动推断：

| 优先级 | 来源               | 说明                                   |
| ------ | ------------------ | -------------------------------------- |
| 1      | Commander 明确描述 | 对话中明确说明的内容                   |
| 2      | 项目现有实现       | 已有类似功能的模式                     |
| 3      | 架构约束           | `memory/architecture.md` 中的决策（如有） |
| 4      | 技术栈约定         | `memory/tech-stack.md` 中的选型（如有）   |
| 5      | 行业惯例           | 该类功能的常见实现方式                 |
| 6      | MVP 原则           | 不确定时选择最小可行方案               |

---

## 编译序列（三步顺序，不可颠倒）

### Step 1: 产出 PRD.md

**路径**: `pipeline/0_requirements/PRD.md`

```markdown
## <!-- Author: PM -->

project: <项目名>
compiled_from: "<Commander 的原始描述，一字不改>"
status: PENDING_GATE_0

---

## 1. 业务背景

<为什么做？解决什么痛点？>

## 2. 用例清单 (Use Cases)

- UC-01: <主流程>
- UC-02: <次流程/异常流>

## 3. 非功能性需求

- 预估并发量: <推断或标记 TBD>
- 安全要求: <推断或标记 TBD>

## 4. 假设登记表（Commander 需确认）

> 对每个功能/决策，逐维度扫描隐含假设。PM 负责 Value/Usability/Viability 三个维度，Feasibility 留给 Lead 在 Stage 1 补充。

**维度扫描提示（每个功能过一遍）**:
- **Value（价值）**: 用户真的需要这个吗？痛点有证据还是我们猜的？
- **Usability（可用性）**: 用户能在目标场景下顺畅使用吗？是验证过还是想当然？
- **Viability（商业可行性）**: 商业模式/合规/成本，哪些是确认的哪些是推测？

| ID | 假设描述 | 维度 | 依据来源 | 影响(H/M/L) | 风险(H/M/L) | Commander 确认 |
|----|---------|------|---------|------------|------------|---------------|
| A-01 | <假设内容> | Value/Usability/Viability | <来源优先级> | H/M/L | H/M/L | YES/NO |
| A-02 | <假设内容> | Value/Usability/Viability | <来源优先级> | H/M/L | H/M/L | YES/NO |
```

**Impact × Risk 说明**:

- **影响(Impact)**: 如果此假设不成立，下游返工规模。H=大面积返工，M=局部调整，L=可忽略
- **风险(Risk)**: 此假设不成立的可能性。H=无证据支撑，M=有间接证据，L=有直接证据
- **H×H 项**: 高影响且高风险的假设，必须在 Gate 2 前有验证结论，否则阻断流水线

### Step 2: 产出 FEATURE_LIST.md（功能追踪矩阵）

**路径**: `pipeline/0_requirements/FEATURE_LIST.md`

FEATURE_LIST 是项目的追踪脊柱，包含两部分：追踪总表 + 功能详情。PM 创建时初始化"PM"列，后续阶段角色各自更新对应列。

**结构（追踪总表 + 两级详情，不可扁平化）**:

```markdown
<!-- Author: PM -->

# 功能追踪矩阵 (Feature Traceability Matrix)

> 项目追踪脊柱。各阶段角色按职责更新对应列，Commander 随时可查看整体进度。

## 追踪总表

| F-ID | 功能名称     | PM | 原型 | 接口 | Task | 实现 | QA | 验收 |
|------|-------------|-----|------|------|------|------|-----|------|
| F1.1 | [子功能描述] | ✅  |      |      |      |      |     |      |
| F1.2 | [子功能描述] | ✅  |      |      |      |      |     |      |

## 功能详情

### F1: [大功能名称]

| 编号 | 功能描述（业务语言，零技术术语） | 操作类型                       |
| ---- | -------------------------------- | ------------------------------ |
| F1.1 | [子功能描述]                     | 界面操作 / 接口调用 / 增删改查 |
| F1.2 | [子功能描述]                     | ...                            |

### F2: [大功能名称]

...
```

**验收标准**:

- 追踪总表中每个子功能 F-ID 一行，PM 列全部标 ✅
- 功能详情中每条子功能（F1.1）有唯一编号
- 无技术术语（无 API 路径、无数据库表名、无框架名）
- Commander 逐条过目确认，无遗漏无多余

### Step 3: 产出 BDD_Scenarios.md

**路径**: `pipeline/0_requirements/BDD_Scenarios.md`

**格式（严格 Gherkin）**:

```gherkin
<!-- Author: PM -->

Feature: [功能名称]

  # F1.1 — [对应 FEATURE_LIST 编号]
  Scenario: [Happy Path] [正常流描述]
    Given <前置条件，包含具体数据>
    When <用户动作>
    Then <系统响应，包含状态码或可观测行为>
    And <副作用，如审计日志、状态变更>

  # F1.1 — [对应 FEATURE_LIST 编号]
  Scenario: [Error Case] [异常流描述]
    Given <前置条件>
    When <触发异常的动作>
    Then <系统阻断行为，包含错误码或错误提示>
    And <数据一致性保障，证明无脏写>
```

**强制规则**:

- 每个 FEATURE_LIST 子功能 ≥ 1 个 Happy Path + 1 个 Error Case
- 每条 Scenario 首行注释对应 F-ID（如 `# F1.1`）
- Given/When/Then 中**禁止**出现 SQL、API 路径、字段名、框架名
- Then 必须描述可观测行为，禁止模糊描述（❌"系统处理成功" ✅"用户看到'登录成功'提示"）

---

## Exit Gates（进入 fusion-validate-req 的条件）

- [ ] PRD.md 四章节完整（含假设登记表）+ Author Stamp 存在
- [ ] 假设登记表非空，每条假设有维度 + Impact×Risk 评级
- [ ] FEATURE_LIST.md 所有子功能有唯一 F-ID
- [ ] BDD_Scenarios.md 每个 F-ID 有 Happy Path + Error Case
- [ ] BDD 中无技术术语
- [ ] 三份文档的内容互相一致（PRD 用例 ↔ FEATURE_LIST 功能 ↔ BDD 场景 一一对应）
