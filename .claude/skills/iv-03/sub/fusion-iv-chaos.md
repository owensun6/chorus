---
name: fusion-iv-chaos
description: iv-03 专用。混沌与极限破坏测试：边界值注入、超时降级、极限负载、异常操作序列。
---

# fusion-iv-chaos — 混沌与极限破坏测试


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 极限条件下验证优雅降级能力
2. **这些步骤已经不可原子级再分了吗？**
   → 边界值注入 → 超时降级 → 极限负载 → 异常操作序列，4 个维度逐一独立验证。

---

## 验证步骤

### Step 1: 边界值注入（11 个场景）

**字符串边界**:

| 测试输入                             | 期望响应                       | 必须避免       |
| ------------------------------------ | ------------------------------ | -------------- |
| 空字符串 `""`                        | 400 Bad Request                | 500 / 存入 DB  |
| 单字符 `"a"`                         | 视业务规则                     | 静默截断       |
| 最大长度 + 1 字符                    | 400 Bad Request                | 500 / 静默截断 |
| 纯空格 `"   "`                       | 400 Bad Request（trim 后为空） | 存入 DB        |
| 特殊字符 `<script>alert(1)</script>` | 安全存储（已转义）             | 原样存储 + XSS |

**数字边界**:

| 测试输入               | 期望响应                                 |
| ---------------------- | ---------------------------------------- |
| 0                      | 视业务规则（订单数量0是否允许？）        |
| 负数 `-1`              | 400 Bad Request（如果业务不允许）        |
| 超大数字 `99999999999` | 400 Bad Request 或正常存储（视字段定义） |
| NaN / Infinity         | 400 Bad Request                          |

**日期边界**:

- Unix 时间戳 0（1970-01-01）
- 未来极远日期（9999-12-31）
- 闰年 2 月 29 日
- 跨时区极限（UTC+14 / UTC-12）

### Step 2: 超时与降级

**网络超时模拟**:

```typescript
// 使用 Playwright 拦截并延迟响应
await page.route('/api/**', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 6000)); // 6秒延迟
  await route.continue();
});
```

**验证点**:

- 前端：5 秒后是否显示超时提示？是否有重试按钮？
- 后端：API 是否在超时后返回 503 而非挂死？
- 第三方服务不可用时：主流程是否有 fallback？用户是否看到有意义的错误信息？

### Step 3: 极限负载

**并发重复提交**:

```typescript
// 模拟表单快速双击
const requests = Array(10)
  .fill(null)
  .map(() =>
    fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ item: 'test', qty: 1 }),
    }),
  );
const responses = await Promise.all(requests);
// 期望: 只有 1 个 201 Created，其余 409 Conflict 或 200 幂等
const created = responses.filter((r) => r.status === 201);
expect(created.length).toBe(1);
```

**大 Payload 测试**:

- 超过限制大小的请求是否返回 413 Payload Too Large？
- 是否触发内存溢出风险（观察服务器内存）？

### Step 4: 异常操作序列

**快速退出（操作中断）**:

- 用户在表单提交后立即关闭页面 → 是否有孤立事务残留？
- 文件上传中途取消 → 是否有部分文件残留在存储中？

**幂等性验证**:

- 同一个带幂等 Key 的请求发送两次 → 是否只创建一条记录？
- 重试机制：请求失败后自动重试，是否会导致重复操作？

---

## 报告格式

```markdown
<!-- Author: iv-03 -->

# Chaos & Edge Case Report — <task-id>

## 结论: PASS / FAIL

## 边界值测试

| 场景       | 输入     | 期望响应 | 实际响应 | 状态    |
| ---------- | -------- | -------- | -------- | ------- |
| 超长用户名 | 1001字符 | 400      | 500      | ❌ FAIL |

## 超时降级测试

- API超时(5s): PASS/FAIL — 用户看到: [描述]
- 第三方服务不可用: PASS/FAIL

## 极限负载测试

- 10 并发重复提交: PASS/FAIL — 产生了 X 条重复记录

## 总体韧性评估

[3-5 句话总结系统在极限条件下的表现]
```

---

## 审计后强制写回（iv-03 是最终漏斗）

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，7 道漏斗全部通过，生成总结性 `Audit_Report.md`，通知 Commander Gate 3 条件满足
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，Dev 返工
3. **iv-03 PASS = Stage 6 完成** → 立即生成 `pipeline/3_review/Audit_Report.md` 汇总 7 道漏斗结果
