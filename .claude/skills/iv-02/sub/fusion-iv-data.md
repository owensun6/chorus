---
name: fusion-iv-data
description: iv-02 专用。数据穿透性与 ACID 验证：UI→DB 完整链路、序列化保真、并发保护、事务原子性。
---

# fusion-iv-data — 数据穿透性与 ACID 验证


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 验证 UI→DB 数据保真与 ACID
2. **这些步骤已经不可原子级再分了吗？**
   → 数据穿透 → 序列化保真 → 并发保护 → 缓存一致性 → 事务原子性，5 个维度逐一验证。

---

## 输入文件

| 文件                                            | 用途                      |
| ----------------------------------------------- | ------------------------- |
| `pipeline/1_architecture/Data_Models.md`        | 字段类型规格（精度/约束） |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 并发保护要求              |

---

## 验证步骤

### Step 1: 数据穿透性全链路追踪

追踪关键字段从 UI 输入到 DB 存储再到 UI 展示的完整旅程：

```
输入值 → API Request Body → Service 层 → DB 写入值 → DB 读出值 → API Response → UI 展示值
```

**关注点**:

- null 值：是否在某层被转换为空字符串或 "null" 字符串？
- 空字符串：是否在某层被转换为 null？
- 零值 (0)：是否在某层被过滤掉？
- 特殊字符（`<>'"&`）：是否在传输中被转义/改变？

### Step 2: 序列化/反序列化保真

| 字段类型  | 验证方法                                                               |
| --------- | ---------------------------------------------------------------------- |
| 日期/时间 | 写入 UTC 时间，读出后时区是否保真？ISO 8601 格式是否完整？             |
| 数字精度  | Decimal(10,2) 字段，存入 99.99，读出是否还是 99.99 而非 99.990000001？ |
| 枚举值    | 枚举大小写是否一致？前端 "ACTIVE" vs 后端 "active" 是否有对齐？        |
| Boolean   | true/false 是否在序列化中被转换为 1/0 或 "true"/"false" 字符串？       |

### Step 3: 并发写入保护

**乐观锁验证**:

```typescript
// 模拟并发更新
const [r1, r2] = await Promise.all([
  fetch('/api/resource/1', {
    method: 'PUT',
    body: JSON.stringify({ version: 1, data: 'update-a' }),
  }),
  fetch('/api/resource/1', {
    method: 'PUT',
    body: JSON.stringify({ version: 1, data: 'update-b' }),
  }),
]);
// 期望: 一个 200 成功，一个 409 冲突
expect([r1.status, r2.status]).toContain(409);
```

**验证点**:

- 版本号冲突时是否返回 409 Conflict？
- 错误消息是否明确指明冲突原因？

### Step 4: 缓存一致性（如有缓存层）

- 写操作后，立即读取是否能得到最新数据（缓存失效）？
- 读穿透保护：10 个并发请求读同一不存在的 key，是否只有 1 个请求穿透到 DB？

### Step 5: 事务原子性

模拟多步操作中的失败场景：

- 步骤 1 成功 + 步骤 2 失败 → 步骤 1 是否回滚？
- 数据库中是否有孤立的半完成状态记录？

---

## 报告格式

```markdown
<!-- Author: iv-02 -->

# Data ACID Audit Report — <task-id>

## 结论: PASS / FAIL

## 数据穿透测试

| 字段       | 输入值               | DB存储值            | 读出值     | 状态        |
| ---------- | -------------------- | ------------------- | ---------- | ----------- |
| created_at | 2026-03-03T08:00:00Z | 2026-03-03T00:00:00 | 2026-03-03 | ❌ 时区丢失 |
| amount     | 99.99                | 99.99               | 99.9900001 | ❌ 精度丢失 |

## 并发测试结果

- 乐观锁冲突测试: PASS/FAIL
- 事务回滚测试: PASS/FAIL
```

---

## 审计后强制写回

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，通知 iv-03 启动
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，iv-03 不得启动
