---
name: fusion-qa-performance
description: qa-02 专用。性能审计 + UI/UX 一致性批判：N+1、重绘、DOM 深度、UI_CONTRACT 对齐。
---

# fusion-qa-performance — 性能审计与 UI/UX 一致性批判


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 审计性能瓶颈 + UI/UX 一致性
2. **这些步骤已经不可原子级再分了吗？**
   → 性能审计（5 项）→ UI/UX 一致性审计（3 项），每项独立检查，不合并。

---

## 输入文件

| 文件                                            | 用途                        |
| ----------------------------------------------- | --------------------------- |
| `pipeline/0_5_prototype/UI_CONTRACT.md`         | UI 组件状态规格（权威约束） |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 验收标准                    |
| `pipeline/5_dev/` 下的源码                      | 审查对象                    |

---

## 性能审计（5 项）

### P1: 长列表渲染

- 是否有 1000+ 条数据直接渲染（未分页/虚拟滚动）？
- DOM 深度是否超过 10 层？

**CRITICAL 阈值**: 直接渲染 > 1000 条无虚拟化 → CRITICAL

### P2: 过量重渲染（React）

- 父组件状态变化是否触发不必要的子组件重渲染？
- 是否缺少 `React.memo` / `useMemo` / `useCallback` 保护？
- Props 对象是否每次都是新引用？

### P3: N+1 查询

在后端代码中，检查：

- 循环内部是否有数据库查询（`for (item of list) { await db.find(...) }`）
- 应使用 Prisma `include` 或 SQL `JOIN` 批量获取关联数据

**CRITICAL 阈值**: N+1 导致在 100 条数据下执行 100+ 次 DB 查询 → CRITICAL

### P4: 慢查询风险

- 无索引字段上的全表 `WHERE` 查询
- 大数据量上的 `ORDER BY` 无索引字段
- 对照 `db-schema-designer` 的索引定义验证

### P5: 内存泄漏信号

- 事件监听是否在组件卸载时 `removeEventListener`？
- RxJS/订阅是否在 `ngOnDestroy` / `useEffect cleanup` 中取消？
- 定时器 (`setInterval`) 是否有销毁逻辑？

---

## UI/UX 一致性审计（3 项）

### U1: UI_CONTRACT.md 对齐

逐组件对照 UI_CONTRACT.md 检查：

- 组件名称是否一致？
- 所有状态变体（正常/Loading/Error/Empty）是否全部实现？
- 按钮禁用/启用条件是否符合约定？

### U2: 交互行为一致性

- Loading 状态：骨架屏/Spinner 与原型一致？
- Error 状态：错误文案与 UI_CONTRACT 中定义一致？
- Empty 状态：空数据提示与原型一致？

### U3: 无障碍基线（WCAG AA）

- 所有 `<img>` 有 `alt` 属性？
- 所有 `<button>` 有可读文本或 `aria-label`？
- 前景色与背景色对比度 ≥ 4.5:1？

---

## 报告格式

```markdown
<!-- Author: qa-02 -->

# Audit Report — <task-id>

## 结论: PASS / FAIL

## 性能问题

### CRITICAL

- [PC1] 问题描述 + 影响范围 + 建议优化方案

### HIGH

- [PH1] 问题描述 + 优化建议

## UI/UX 一致性问题

### CRITICAL (与 UI_CONTRACT.md 严重偏差)

- [UC1] 组件名 — 期望行为 vs 实际行为

### HIGH

- [UH1] 问题描述
```

---

## 审计后强制写回

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，通知 qa-03 启动
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，后续漏斗不得启动
