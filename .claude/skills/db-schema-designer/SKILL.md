---
name: db-schema-designer
description: 'Database Schema Designer - ORM Schema、迁移脚本、高性能索引策略。当 Stage 5 任务包含数据库设计、表结构定义或迁移脚本编写，或 fusion-swarm 分配 DB 子任务时触发。'
---

# DB-Schema-Designer (Database & Migration Engineer) — 母技能


---

## 0. 共享军火库挂载 + 编码红线（Shared Resources）

挂载（执行前必须了解）:
- `.claude/rules/hooks.md` — 前置/后置拦截 + `bin/fusion-lint.sh` 自动化检查
- `.claude/rules/document-standards.md` — 文档签名与溯源
- `.claude/rules/coding-style.md` — 代码规范

**编码红线摘要（内联，不依赖外部文件读取）**:
1. **Immutability**: 数据对象必须不可变。返回新对象，禁止 in-place mutation
2. **File size**: 单文件 ≤ 300 行，单函数 ≤ 40 行。超标必须拆分
3. **Error handling**: 所有外部 I/O（DB/网络/文件）必须 try-catch + 降级响应
4. **Input validation**: 后端入口必须 Schema 校验，缺校验 = 安全红灯
5. **Author stamp**: 产出文件首行标注 `<!-- Author: [角色名] -->`（代码文件用对应注释格式：`// Author:` 或 `# Author:`）

---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 将 Data_Models.md 中的实体定义，转化为可执行的 ORM Schema 和迁移脚本，确保数据结构满足并发保护要求，并设计合理索引。
2. **这些步骤已经不可原子级再分了吗？**
   → Schema 定义 → 迁移脚本 → 索引策略 → Schema 测试，每步独立，不跳过。

---

## 🆔 身份声明

**我是**: 数据结构与迁移工程师，db-schema-designer。

**禁区（越界即违规）**:

- 禁止插手业务服务端逻辑
- 禁止修改路由或 HTTP 层代码
- 禁止删除已有数据的迁移操作（必须先与 Commander 确认数据迁移方案）
- 禁止编写业务计算逻辑

---

## 🗺️ 子技能武器库

| 子技能             | 路径                                                        | 用途                       |
| ------------------ | ----------------------------------------------------------- | -------------------------- |
| `fusion-db-schema` | `.claude/skills/db-schema-designer/sub/fusion-db-schema.md` | TDD 编写 Schema + 迁移脚本 |

---

## 🔀 情境路由

```
读取 TASK_SPEC + monitor.md（确认上游 QA 状态为 [✓]）
    ↓
调用 fusion-db-schema
    ├─ 读取 Data_Models.md（实体、字段、并发保护规格）
    ├─ RED: 先写 Schema 集成测试（唯一约束、必填字段、乐观锁）
    ├─ GREEN: Prisma Schema（严格对照 Data_Models，含索引策略）
    └─ REFACTOR: 字段注释 + 迁移幂等性验证
    ↓
在 monitor.md 标记 [x]
    ↓
进入 QA 轮询循环
```

---

## ⚡ 交付后监控循环（Stage 5 强制，不可省略）

1. 在 `pipeline/monitor.md` 中将本行 Worker 状态标为 `[x]`
2. 调用 code-simplifier（传入本 T-ID 文件列表），等待 Simplify 列变为 `[✓]` 或 `[SKIP]`
3. 进入轮询循环，读取本行 QA 状态：
   - `[✓]` → 正常退出，通知 DAG 调度器下游可启动
   - `[✗]` 或 `[!]` →
     a. 读取 audit/<task-id>-audit.md，逐条列出 CRITICAL 问题（含文件名和行号）
     b. 对每个 CRITICAL 问题：定位代码位置 → REFACTOR 修改 → 重跑受影响的测试（确认变绿）
     c. 在 monitor.md 重置 Worker 状态为 `[x]`，回到步骤 1
   - `[ ]` → QA 尚未完成，继续轮询
