---
name: fusion-qa-security
description: qa-03 专用。OWASP Top 10 安全零信任审计：越权/注入/XSS/CSRF/Token/硬编码/输入验证/错误泄露。
---

# fusion-qa-security — 安全零信任审计


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → OWASP Top 10 全覆盖安全审计
2. **这些步骤已经不可原子级再分了吗？**
   → 8 项 OWASP 检查逐一独立执行，不合并，不跳过。每项检查结果独立记录。

---

## 输入文件

| 文件                                   | 用途                     |
| -------------------------------------- | ------------------------ |
| `pipeline/1_architecture/INTERFACE.md` | API 端点清单（权限要求） |
| `pipeline/5_dev/` 下的源码             | 审查对象                 |

---

## OWASP Top 10 审查清单（逐项执行）

### S1: 越权 (IDOR — Insecure Direct Object Reference)

每个 API 端点检查：

- 不仅验证 "用户已登录"，还验证 "用户对该资源有所有权"
- 例：`GET /api/orders/:id` — 是否检查 `order.userId === req.user.id`？
- 批量接口是否有注入他人 ID 的风险？

**CRITICAL 触发**: 任何端点可通过修改 ID 访问他人数据 → 立即停工上报

### S2: SQL/NoSQL 注入

- 所有 DB 查询是否使用 ORM 参数化方法？
- 是否有字符串拼接 SQL：`WHERE id = ${userId}`？（禁止）
- MongoDB 查询是否有 `$where` 或不受控的操作符注入？

**CRITICAL 触发**: 任何可被注入的查询 → 立即停工上报

### S3: XSS (跨站脚本)

- 前端是否有直接将用户输入注入 DOM 的代码（innerHTML 直接赋值等）？
- 是否使用了允许原始 HTML 渲染的 API 而未经过 DOMPurify 净化？
- 服务端返回的用户数据在前端渲染时是否转义？

**审查重点**: 搜索任何将用户可控数据直接插入 HTML 结构的模式。

### S4: CSRF (跨站请求伪造)

- 状态变更接口（POST/PUT/DELETE）是否有 CSRF Token 验证？
- Cookie 是否设置 `SameSite=Strict` 或 `SameSite=Lax`？
- 敏感操作是否要求重新验证身份？

### S5: Token 过期处理

- JWT/Session 过期时是否返回 401 而非 200？
- 刷新 Token 是否单独保护（HttpOnly Cookie）？
- Token 是否存储在 `localStorage`？（建议改为 HttpOnly Cookie）

### S6: 硬编码凭证扫描

扫描代码中的：

- API Key、密码、Secret（即使是"测试用"）
- 数据库连接字符串
- 私钥、证书内容

```bash
# 快速扫描
grep -rn "apiKey\|password\|secret\|token" src/ --include="*.ts" --include="*.tsx" | grep -v ".env"
```

**CRITICAL 触发**: 发现任何硬编码凭证 → 立即停工上报

### S7: 输入验证（零信任）

- Controller 层是否有 Zod/Joi Schema 强验证？
- 用户输入是否直接透传到下游服务或数据库？
- 文件上传是否有类型/大小/内容验证？

### S8: 错误信息泄露

- 500 错误响应是否暴露了栈追踪（stack trace）？
- 错误消息是否包含数据库表名、内部路径、代码行号？
- 登录失败是否区分 "用户不存在" 和 "密码错误"？（应统一返回"凭证无效"）

---

## 报告格式

```markdown
<!-- Author: qa-03 -->

# Security Audit Report — <task-id>

## 结论: PASS / FAIL

## 安全漏洞

### CRITICAL (立即停工，必须修复)

- [S-C1] 漏洞类型 — 漏洞位置 — 攻击路径描述 — 修复建议

### HIGH (强烈建议修复)

- [S-H1] 问题描述 + 修复建议

### MEDIUM

- [S-M1] 问题描述

## OWASP 覆盖摘要

| 检查项        | 结果      |
| ------------- | --------- |
| S1 越权 IDOR  | PASS/FAIL |
| S2 SQL注入    | PASS/FAIL |
| S3 XSS        | PASS/FAIL |
| S4 CSRF       | PASS/FAIL |
| S5 Token过期  | PASS/FAIL |
| S6 硬编码凭证 | PASS/FAIL |
| S7 输入验证   | PASS/FAIL |
| S8 错误泄露   | PASS/FAIL |
```

---

## 审计后强制写回

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，通知 qa-04 启动
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，后续漏斗不得启动
3. **发现 CRITICAL 安全漏洞 → 立即停工上报 Commander，不等后续漏斗**
