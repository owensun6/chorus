# Fusion-Core 测试驱动开发与质量标准 (Testing Paradigm)

在 Fusion-Core `Stage 5` 实施阶段，测试不是验证工作，而是**设计规范的物理延伸**。所有大模型 Agent 均在此约束场内作业。

## 1. 最低覆盖率断言锁 (80% Coverage Baseline)

本项目引入严格的代码覆盖率漏斗卡口：

- 所有新特性的**最低覆盖率底线为 80%**。
- GitHub Actions CI 的 `.github/workflows/ci.yml` 已配置 `test:coverage` 扫描，覆盖率低于 80% 将阻断 PR 合并并报错 `(Exit Code 1)`。

## 2. 三级维度的兵种分兵 (Testing Pyramid & Roles)

在 13 专才模型中，各兵种的测试疆界不得越界与混淆：

1. **Unit Tests (单元测试)**: 交由 `[Role: Dev]` 端内人员 (如 `be-domain-modeler`, `fe-logic-binder`) 自测。保证单个 Function 的出入参健壮。
2. **Integration Tests (集成联调)**: 交由 `[Role: Reviewer]` 军团中的 `qa-02 (契约合规)` 或专门的联调兵执行，以 API Payload 测试为主。
3. **E2E Tests (端到端验收)**: 隔离交给 `[Role: E2E 特种兵]` (如 `iv-01`, `iv-02` 造影验证兵种) 执行。他们使用 Playwright 等工具。Dev 特种兵被禁止私自篡改 E2E 脚本。

## 3. TDD 红绿法则 (Red-Green-Refactor Protocol)

在写下任何一行真实业务代码之前，必须先写测试。
大模型 Agent 工具调用的正确姿势必须依循以下逻辑：

1. **Step 1 (Red)**: 基于 `PRD` 先生成失败的 Jest 测试快照文件。
2. **Step 2 (Green)**: 注入业务代码直到终端反馈为绿色 ✅。
3. **Step 3 (Refactor)**: 结合 `coding-style.md` 的行数限制，进行拆分重构。

> **[!] 严禁跳过红状态**: Agent 如果未提供测试挂起的报错日志，而直接提供最终测试绿灯的代码，视为**作弊器幻觉**，必须立即打回并触发警报。
