# Fusion-Core Gate 审批验证与异常处置协议

> **[!] CRITICAL**: 每一个 Gate 都是一道生死门。绝不允许未携带绿灯盖戳的交付物越界进入下一个阶段。

## 0. Gate 提交前置条件：FP 自检日志（所有 Gate 强制）

任何角色在提交 Gate 审批前，**必须**在提交信息中附带以下 FP 自检日志。缺少此日志 → Gate 拒绝受理。

```
FP-1 目的: [用自己的话说清本阶段的目的，禁止复制 SKILL.md 原文]
FP-2 原子性: [列出本阶段中被删除/合并的步骤及理由；若无删减，说明为什么每步都不可再分]
```

> 此规则将 FP 两问从 SKILL.md 头部的"提醒文字"升级为 Gate 的物理前置条件。没有自检日志 = 没有思考 = 不受理。

---

## 1. 批准流程 (Approve)

- **动作**: Commander 在审阅输入产物后，明确回复文字或由自动化 Hook 拉起绿色盖章。
- **后置执行**:
  1. Agent 立即将当前阶段的核心产出物加上 `<!-- status: APPROVED -->` 的元数据标签。
  2. Hook 自动更新 `pipeline/monitor.md` 对应的 Gate 槽位状态为 `✅`。
  3. 全局 Agent 将被授权进入下一个预设的 Stage。

> Gene Extractor 不再自动触发。需要萃取经验时，Commander 手动调用 `/fusion-extract-genes`。

## 2. 拒绝与返工流 (Reject & Rework Loop)

绝不允许 Commander 拒绝后，Agent 在当前杂乱的上下文里“乱改一通”然后强推。

- **触发条件**: 任何维度的不过关（需求模糊、架构错乱、检查亮红灯）。
- **强制闭环执行路线**:
  1. **Reject 签收**: 立即冻结当前进程。将 Commander 的拒绝理由（哪怕是一句话）原样记录至 `pipeline/monitor.md` 尾部的“风险日志列”。
  2. **Rework 物理回退**: 负责该阶段的 Agent 必须重新拉起其核心动作（若是 Stage 0，必须重新呼叫 `fusion-pm-interview`；若是 Stage 5，必须重新运行 TDD 的 Red 阶段）。
  3. **Re-submit 重新递交**: 将修改后的完整文件作为新的交付物，打上 `<!-- status: RE-SUBMITTED -->` 标签，再次叩关求过。

## 3. 熔断与升级处置 (Escalation)

AI 工作流极易陷入“越修越错”的死亡螺旋。我们通过硬锁死机制防止 Token 燃烧。

- **触发阈值**: 同一 Gate，连续遭受 Commander **3 次** Reject。
- **强制动作**:
  1. 立即触发 Escalation 警报。当前 Agent 需停止一切技术尝试。
  2. 输出：“Commander，已连续 3 轮无法令您满意，触发系统熔断机制。请问我们是否需要**废弃当前史诗 (Epic)**，重新回退到 Stage 0 重新定义需求？”
  3. 在 Commander 回复之前，系统挂起。

## 4. Gate 2 假设硬锁 (Assumption Hard Lock)

Gate 2（Stage 3 → Stage 4）新增前置条件：

- **Lead 汇总**: 合并 PRD 假设登记表（Section 4）+ INTERFACE.md 架构层假设，输出汇总清单
- **H×H 检查**: 所有 Impact=H 且 Risk=H 的假设，必须有验证结论（已证实 / 已证伪并调整方案 / Commander 豁免）
- **未验证 H×H → 阻断**: Gate 2 不通过，不准进入 Stage 4 实施阶段

验证结论的形式不限：用户访谈记录、技术 Spike 代码、第三方文档截图、Commander 口头确认均可。关键是**有结论**，而非**仍为假设**。

### 测试规格检查（Gate 2 附加条件 — 仅完整版 TASK_SPEC）

> LITE 版 TASK_SPEC 豁免此检查。LITE 版只需验收命令可执行（exit 0 = 通过）。

- 每份完整版 TASK_SPEC 的「测试规格」章节必须非空（至少 1 个 test_case）
- test_case 数量 ≥ BDD Given-When-Then 条数（每条验收标准至少 1 个测试用例）
- 测试文件路径必须明确（禁止占位符 `TBD`）

### 结构性约束检查（Gate 2 附加条件 — 仅完整版 TASK_SPEC）

> LITE 版 TASK_SPEC 豁免此检查。

- 每份完整版 TASK_SPEC 的「结构性约束测试」章节必须已填写
- immutability 和 input_validation 两项不可同时为 N/A（除非该 Task 确实不涉及数据结构和外部输入，需附理由）
- 涉及鉴权/权限的 Task（Assignee 为 be-api-router 或 be-domain-modeler 且有 auth 相关 BDD）必须填写 auth_boundary

## 5. 快速通道物理锁 (Fast-Track Limitations)

- **触发**: 仅针对单文件修改或极轻量脚本需求，且 Commander 在初始意图时明确授权 `跳过架构设计`。
- **效果**: 只允许绕过 Stage 1 (系统架构) 和 Stage 1.5 (原型交互)。
- **物理反向锁死**:
  1. Stage 0 (需求定义) **永远不可跳过**。系统必须知道你在干嘛。
  2. 只要此次开发任务横跨 **前端 + 后端**，或者需要涉及数据库修改，Fast-Track 许可令牌立即自动回收销毁。必须滚回 Stage 1 老老实实画架构图。
