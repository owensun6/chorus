# Stage 6: 多维审计 — 原子进度追踪

> 角色: QA/IV Reviewer（7 道串行漏斗）
> 上游依赖: Stage 5 所有 Dev Worker 状态 `[x]`
> 铁律: 前一道 FAIL → 后续道次不得启动

## 7 道漏斗串行管道

| # | 漏斗 | 角色 | 审查维度 | 状态 | 完成标志 |
|---|------|------|---------|------|---------|
| 1 | qa-01 | Functional Logic Reviewer | TDD 证据链 + 单测 + 覆盖率 + 空指针 + 死循环 + 业务 BUG | ⬜ | Proof-of-Work 报告产出 + Verdict = PASS/FAIL |
| 2 | qa-02 | Performance & UI/UX Critic | N+1 查询 + 重绘 + DOM 深度 + UI_CONTRACT 一致性 | ⬜ | 审计报告产出 + 0 CRITICAL |
| 3 | qa-03 | Security Zero-Trust Auditor | OWASP Top 10（注入/XSS/CSRF/IDOR/硬编码/越权/限流/报错） | ⬜ | 8 项 OWASP 逐条出结论 + 0 CRITICAL |
| 4 | qa-04 | Domain Logic Validator | 业务不变量 + 医疗规范合规 + PRD 验收对齐 | ⬜ | PRD 验收条目逐条对齐 + 0 CRITICAL |
| 5 | iv-01 | E2E Connectivity | Playwright 核心旅程 + HTTP 全绿 + CORS 配置 | ⬜ | E2E 测试 exit 0 + HTTP 状态码无 4xx/5xx |
| 6 | iv-02 | Data Penetration & ACID | 序列化完整性 + 并发写入保护 + 缓存失效 | ⬜ | 数据穿透验证 PASS + ACID 测试 PASS |
| 7 | iv-03 | Chaos & Edge Case | 边界值注入 + 超时降级 + 内存溢出预警 | ⬜ | 边界值注入未导致崩溃 + 降级机制生效 |

## qa-01 原子步骤（第一道漏斗，最关键）

| # | 原子步骤 | 状态 | 完成标志 |
|---|---------|------|---------|
| 1.0 | TDD 证据链验证（git log: test(red) 早于 feat(green)） | ⬜ | `git log` 中 RED commit 存在且早于 GREEN commit |
| 1.1 | 运行全部单元测试 + 收集覆盖率 | ⬜ | 测试命令 exit 0 + 覆盖率数值已记录 |
| 1.2 | 检查覆盖率（语句 ≥ 80%，分支覆盖关键路径） | ⬜ | 语句覆盖率 ≥ 80%（数值写入报告） |
| 1.3 | 扫描空指针风险（链式调用/返回值未验证/解构无默认值） | ⬜ | 风险清单已产出（可为空 = 无风险） |
| 1.4 | 死循环检测（while终止/递归base case/Promise超时） | ⬜ | 风险清单已产出（可为空 = 无风险） |
| 1.5 | 对照 TASK_SPEC 逐条验收业务逻辑 | ⬜ | 每条 BDD Given-When-Then 有对应验证结论 |
| 1.6 | 检查外部 I/O 错误处理完整性 | ⬜ | 每个外部调用点有 try-catch 或错误处理 |
| 1.7 | 产出 Proof-of-Work 审计报告 | ⬜ | 报告含 TDD/覆盖率/Issues 结构化表格 + Verdict |
| 1.8 | 更新 monitor.md QA 状态（[✓] / [✗]） | ⬜ | monitor.md 对应行 QA 列已更新 |

## Gate 3 条件

| # | 条件 | 状态 | 完成标志 |
|---|------|------|---------|
| 1 | 7 道漏斗全部 PASS | ⬜ | 7 道漏斗状态均为 ✅ |
| 2 | Audit_Report.md 已产出 | ⬜ | 文件存在 + 含 7 道漏斗汇总结论 |
| 3 | Integration_Report.md 已产出 | ⬜ | 文件存在 + 含 E2E/数据穿透/混沌测试结论 |
| 4 | Commander 签字 | ⬜ | monitor.md Gate 3 状态 = ✅ |
