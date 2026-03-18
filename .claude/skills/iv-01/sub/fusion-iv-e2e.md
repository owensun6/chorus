---
name: fusion-iv-e2e
description: iv-01 专用。Playwright E2E 端到端连通性验证：核心用户旅程、HTTP 状态码、CORS、路由保护。
---

# fusion-iv-e2e — E2E 端到端连通性验证


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → E2E 验证核心用户旅程畅通
2. **这些步骤已经不可原子级再分了吗？**
   → 主流程场景 → HTTP 状态码 → 跨端一致性 → CORS/中间件 → 路由跳转，每步独立执行。

---

## 输入文件

| 文件                                       | 用途             |
| ------------------------------------------ | ---------------- |
| `pipeline/0_requirements/BDD_Scenarios.md` | E2E 测试场景来源 |
| `pipeline/0_5_prototype/User_Flow.md`      | 用户旅程路径参考 |

---

## E2E 执行步骤

### Step 1: 核心用户旅程 (Happy Path)

```typescript
// Playwright 示例
import { test, expect } from '@playwright/test';

test('BDD-F1.1: 用户登录并完成核心操作', async ({ page }) => {
  // 1. 导航到登录页
  await page.goto('/login');
  // 2. 填写凭证
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password123');
  // 3. 提交
  await page.click('[data-testid=submit]');
  // 4. 验证跳转
  await expect(page).toHaveURL('/dashboard');
  // 5. 执行核心功能操作
  // ... (按 BDD_Scenarios 逐步执行)
});
```

**覆盖范围**: BDD_Scenarios.md 中所有主流程场景（Happy Path）

### Step 2: HTTP 状态码全绿

监听所有 API 请求，验证：

- 2xx：成功响应
- 无意外 500（内部错误）
- 无意外 404（路由配置问题）
- 无意外 403（权限配置问题）

```typescript
// 监听网络请求
page.on('response', (response) => {
  if (response.url().includes('/api/')) {
    expect(response.status()).toBeLessThan(500);
  }
});
```

### Step 3: 跨端一致性（如有响应式要求）

- 桌面端（1920x1080）：主流程畅通
- 平板端（768x1024）：主流程畅通
- 移动端（375x812）：主流程畅通

### Step 4: CORS 与中间件

- 跨域 API 请求是否返回正确 `Access-Control-Allow-Origin`
- Auth 中间件：未登录用户访问受保护 API 是否返回 401
- 已登录用户访问受保护 API 是否正常通过

### Step 5: 关键跳转与路由

- 受保护路由：未登录用户访问 `/dashboard` 是否重定向到 `/login`
- 404 页面：访问不存在的路由是否显示 404 页面
- 登出后：Session 失效后访问受保护路由是否正确重定向

---

## 截图与报告

截图证据存入 `pipeline/3_review/e2e-screenshots/`

```bash
# Playwright 截图配置
screenshot: 'only-on-failure'
video: 'retain-on-failure'
```

---

## 报告格式

```markdown
<!-- Author: iv-01 -->

# E2E Connectivity Report — <task-id>

## 结论: PASS / FAIL

## 旅程执行结果

| 场景 (BDD Ref) | 步骤数 | 结果    | 截图               |
| -------------- | ------ | ------- | ------------------ |
| BDD-F1.1-01    | 5      | ✅ PASS | screenshot-001.png |
| BDD-F1.2-01    | 8      | ❌ FAIL | screenshot-002.png |

## API 状态码异常

- [E-01] POST /api/auth/login → 500 (期望 200)

## 失败根因分析

[描述失败原因，供 Dev 定位]
```

---

## 审计后强制写回

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，通知 iv-02 启动
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，iv-02/iv-03 不得启动
