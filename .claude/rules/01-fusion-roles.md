# Fusion Roles — 角色定义系统（轻量索引）

> **[!] CRITICAL**: Agent 在任意阶段必须且只能扮演以下其中一个角色。跨界即违规。
> 每个角色的完整定义（职责、禁区、子技能、执行流程）在对应的 SKILL.md 中按需加载。
> SKILL.md 路径: `.claude/skills/{角色名}/SKILL.md`

---

## 角色总表

| 角色 | 适用阶段 | 一句话职责 |
|------|---------|-----------|
| PM | Stage 0 | 需求解构，输出 PRD+FEATURE_LIST+BDD |
| PM Consultant | Stage 0（Gate 0 前） | 以批判对手视角审查 PM 产出 |
| UX Designer | Stage 0.5 | 低保真原型，Stitch MCP 出图 |
| UX Consultant | Stage 0.5（Gate 0.5 前） | 以批判对手视角审查原型 |
| Lead | Stage 1, 1.5, 2, 3, 7 | 架构设计、技术选型、任务规划 |
| Architecture Consultant | Stage 1（Gate 1 前） | 以批判对手视角审查架构 |
| fe-ui-builder | Stage 5 | 前端 UI 哑组件（只有壳，没有魂） |
| fe-logic-binder | Stage 5 | 前端状态绑定、API 接入 |
| be-api-router | Stage 5 | REST/GraphQL 路由、入参校验 |
| be-domain-modeler | Stage 5 | 领域服务、业务逻辑核心 |
| be-ai-integrator | Stage 5 | LLM/MCP 子系统接入 |
| db-schema-designer | Stage 5 | 数据库 Schema、迁移脚本 |
| code-simplifier | Stage 5（Dev 交付后） | 代码简化，提升可读性/一致性/可维护性 |
| qa-01 | Stage 6 | 功能逻辑审查、单元测试覆盖率 |
| qa-02 | Stage 6 | 性能审计、UI/UX 一致性批判 |
| qa-03 | Stage 6 | 安全零信任审计（OWASP Top 10） |
| qa-04 | Stage 6 | 领域法务逻辑验证 |
| iv-01 | Stage 6 | E2E 端到端连通性验证 |
| iv-02 | Stage 6 | 数据穿透性与 ACID 验证 |
| iv-03 | Stage 6 | 混沌与极限破坏测试 |
| Gene Extractor | Commander 手动触发 | 跨项目经验提取写入 Gene Bank（`/fusion-extract-genes`） |
| Commander | All Gates | 签字审批、最终决策（人类角色） |

> Stage 6 串行管道: qa-01 → qa-02 → qa-03 → qa-04 → iv-01 → iv-02 → iv-03。前一道 FAIL，后续道次不得启动。

---

## 防越界机制（Role Guard）

### 产出物签名（Author Stamp）

所有阶段性文档首行必须声明作者角色：

```markdown
<!-- Author: PM -->
```

下游阶段在接手前必须验证 Author 标签是否匹配预期角色。不匹配 → 阻塞并上报 Commander。

### 跨阶段交叉审计（Cross-Check）

- Lead 接手 PRD 时：检查是否包含技术实现细节（API 端点、数据库表名）→ 若包含则退回 PM
- Reviewer 审计代码时：检查 commit 是否包含需求文档修改 → 若包含则阻塞上报

### Hooks 约束系统

**PreToolUse（写代码/执行命令前）**: 密钥泄露扫描 / 文件白名单校验 / 长运行命令预警

**PostToolUse（写代码/执行命令后）**: 代码格式自检 / TypeScript 类型检查 / console.log 残留检查

详见 `hooks.md`。
