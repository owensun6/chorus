# Stage 0.5: UX 低保真原型 — 原子进度追踪

> 角色: UX Designer
> 上游依赖: Gate 0 通过（PRD + FEATURE_LIST + BDD 已 APPROVED）
> 子技能: `fusion-ux-explore` → `fusion-ux-wireframe` → `fusion-ux-contract`
> 跳过条件: 纯后端/CLI/API 项目，Commander 标记 SKIP

## 需求解读与屏幕映射

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 1.1 | 完整阅读 PRD → FEATURE_LIST → BDD（不评论） | ⬜ | | 三文件均已读取（纯输入步骤，无产出物） |
| 1.2 | 提取用户角色列表 | ⬜ | | 角色数量 ≥ 1，与 PRD 中定义一致 |
| 1.3 | 逐 F-ID 建立屏幕映射（功能→屏幕→角色→位置） | ⬜ | | 映射行数 = FEATURE_LIST F-ID 数量 |
| 1.4 | 产出 Feature_Screen_Map.md | ⬜ | `Feature_Screen_Map.md` | 首行 `<!-- Author: UX-Designer -->` + 每 F-ID 有对应屏幕 |
| 1.5 | 更新 FEATURE_LIST 追踪总表"原型"列（填 S-xx） | ⬜ | | FEATURE_LIST "原型"列无空值（覆盖率 100%） |

## 用户流 + 线框图

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 2.1 | 产出 User_Flow.md（每角色核心流 + 异常流） | ⬜ | `User_Flow.md` | 每角色 ≥ 1 核心流 + ≥ 1 异常流 |
| 2.2 | 确认 Stitch MCP 可用 | ⬜ | | Stitch 工具调用返回成功（不可用 → 暂停通知 Commander） |
| 2.3 | 为每个屏幕准备 Stitch Prompt | ⬜ | | Prompt 数量 = Feature_Screen_Map 屏幕数 |
| 2.4 | Stitch MCP 生成初稿 | ⬜ | `Wireframes/stitch-raw/*.png` | 生成文件数 = 屏幕数 |
| 2.5 | 逐屏调用 `get_screen` 导出 HTML 代码 | ⬜ | `stitch-code/*.html` | `ls stitch-code/` 文件数 = 屏幕数 |
| 2.6 | Playwright 打开 HTML 给 Commander 浏览器预览 | ⬜ | | Commander 在浏览器中看到每个屏幕的实际渲染效果 |
| 2.7 | 人工审查调整（确认 F-ID 功能点覆盖） | ⬜ | `Wireframes/*.png` | Commander 确认每屏覆盖对应 F-ID |
| 2.8 | 逐屏标注 notes.md | ⬜ | `Wireframes/*-notes.md` | notes 文件数 = 屏幕数，含区域/功能/操作/跳转四项 |

## UI 契约

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 3.1 | 逐屏写 UI_CONTRACT 章节（布局/组件/状态/导航） | ⬜ | | 章节数 = 屏幕数，每章节含四子项 |
| 3.2 | 写 Design Token 规范（配色/字体/间距/圆角，禁止 dark theme） | ⬜ | | 四类 Token 均有定义值 |
| 3.3 | 写全局契约规则（加载/空状态/错误/文字） | ⬜ | | 四种状态均有 UI 描述 |
| 3.4 | 补充 F-ID 覆盖矩阵 | ⬜ | | 矩阵行数 = F-ID 总数，无空行 |
| 3.5 | 产出 UI_CONTRACT.md | ⬜ | `UI_CONTRACT.md` | 首行 `<!-- Author: UX-Designer -->` + 含上述全部章节 |

## Gate 0.5 审查原子步骤

| # | 原子步骤 | 状态 | 产出物 | 完成标志 |
|---|---------|------|--------|---------|
| 4.1 | UX Consultant F-ID 覆盖检查 | ⬜ | | 覆盖率 = 100%（屏幕/组件/路径全覆盖） |
| 4.2 | UX Consultant 异常场景构造（≥2 个） | ⬜ | | 构造场景数 ≥ 2（中断/网络/新手/空数据） |
| 4.3 | UX Consultant UI_CONTRACT 完整性检查 | ⬜ | | 状态/跳转/空态/一致性四维度逐条出结论 |
| 4.4 | UX Consultant 审查报告产出 | ⬜ | `audit/UX-Consultant-audit.md` | 报告存在 + 含 PASS/REVISE 判定 |
| 4.5 | Commander Gate 0.5 签字 | ⬜ | | monitor.md Gate 0.5 状态 = ✅ |
