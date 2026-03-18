# Stage 0: PM 需求解构 — 原子进度追踪

> 角色: PM
> 上游依赖: Commander 启动指令
> 子技能: `fusion-pm-interview`（模糊需求） / `fusion-compile-req`（清晰需求）

## 路径判定

| 条件 | 路径 | 状态 |
|------|------|------|
| 需求清晰、边界明确 | 快速路径 (`fusion-compile-req`) | ⬜ |
| 需求模糊、有歧义 | 苏格拉底路径 (`fusion-pm-interview`) | ⬜ |

## 苏格拉底路径原子步骤（模糊需求时）

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 0.1 | 探索上下文（读 monitor/历史 PRD/memory） | ⬜ | | 当前 Stage 已在 monitor.md 中确认 |
| 0.2 | 初始化 RAW_CONVERSATION.md（只追加不删除） | ⬜ | `RAW_CONVERSATION.md` | 文件存在 + 首行含日期戳 |
| 0.3 | UX 维度逼问（宣告进入→完成→宣告离开） | ⬜ | | RAW_CONVERSATION 中含 `[UX 进入]` 和 `[UX 离开]` 标记 |
| 0.4 | TECH 维度逼问（宣告进入→完成→宣告离开） | ⬜ | | RAW_CONVERSATION 中含 `[TECH 进入]` 和 `[TECH 离开]` 标记 |
| 0.5 | DATA 维度逼问（宣告进入→完成→宣告离开） | ⬜ | | RAW_CONVERSATION 中含 `[DATA 进入]` 和 `[DATA 离开]` 标记 |
| 0.6 | EVO 维度逼问（宣告进入→完成→宣告离开） | ⬜ | | RAW_CONVERSATION 中含 `[EVO 进入]` 和 `[EVO 离开]` 标记 |
| 0.7 | 确认无 [待验证] 残留 | ⬜ | | `grep "待验证" *.md` = 0 结果 |

## 文档编写原子步骤（两条路径汇合）

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 1.1 | 编写 PRD.md（背景/用例/非功能/假设表） | ⬜ | `PRD.md` | 首行 `<!-- Author: PM -->` + 含章节: 背景/用例/非功能/假设 |
| 1.2 | 编写 FEATURE_LIST.md（追踪总表 + F-ID） | ⬜ | `FEATURE_LIST.md` | F-ID 数量 ≥ 1 + PM 列全标 ✅ |
| 1.3 | 编写 BDD_Scenarios.md（每 F-ID ≥1 Happy + 1 Error） | ⬜ | `BDD_Scenarios.md` | BDD 中 F-ID 集合 = FEATURE_LIST F-ID 集合 |
| 1.4 | 三文档交叉一致性自检 | ⬜ | | PRD F-ID ∩ FEATURE_LIST F-ID ∩ BDD F-ID = 全集，零差集 |

## Gate 0 审查原子步骤

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 2.1 | PM Consultant 边缘场景构造 | ⬜ | | 每核心 F-ID ≥ 1 个 PM 未覆盖的边缘场景 |
| 2.2 | PM Consultant 数字来源追问 | ⬜ | | 无来源数字标 [BLIND SPOT]，数量已记录 |
| 2.3 | PM Consultant 六维度验证 | ⬜ | | 完备/清晰/一致/合理/风险/BDD 六维度逐条出结论 |
| 2.4 | PM Consultant 审查报告产出 | ⬜ | `audit/PM-Consultant-audit.md` | 报告存在 + 含 PASS/REVISE 判定 + CRITICAL 数量 |
| 2.5 | Commander Gate 0 签字 | ⬜ | | monitor.md Gate 0 状态 = ✅ |
