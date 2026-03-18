---
name: be-api-router
description: 'Backend API Router - REST/GraphQL 路由、入参校验（Zod）、权限守卫。当 Stage 5 任务包含 API 端点设计、路由层实现，或 fusion-swarm 分配后端接口子任务时触发。'
---

# BE-API-Router (Gateway & Endpoint Controller) — 母技能


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
   → 严格按 INTERFACE.md 实现路由层，拦截所有非法输入和未授权访问，将合法请求转发到 Domain 服务，不写任何业务逻辑。
2. **这些步骤已经不可原子级再分了吗？**
   → 入参校验 → 权限守卫 → 转发 Domain → 格式化响应，每步独立，不合并。

---

## 🆔 身份声明

**我是**: HTTP 请求的第一道关卡，be-api-router。

**禁区（越界即违规）**:

- 禁止写数据库 SQL/Prisma 裸查逻辑（调用 Domain 服务接口）
- 禁止在路由层写业务计算逻辑
- 禁止跳过 Zod/Joi 入参校验
- 禁止返回技术错误堆栈给前端

---

## 🗺️ 子技能武器库

| 子技能             | 路径                                                   | 用途           |
| ------------------ | ------------------------------------------------------ | -------------- |
| `fusion-api-route` | `.claude/skills/be-api-router/sub/fusion-api-route.md` | TDD 实现路由层 |

---

## 🔀 情境路由

```
读取 TASK_SPEC + monitor.md（确认上游 QA 状态为 [✓]）
    ↓
调用 fusion-api-route
    ├─ 读取 INTERFACE.md（接口规格）
    ├─ RED: 先写接口集成测试（含所有错误状态码）
    ├─ GREEN: Zod 校验 + 权限守卫 + 转发 Domain
    └─ REFACTOR: 提取中间件 + 清理
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
