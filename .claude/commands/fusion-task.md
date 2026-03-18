---
description: 【作战地图】将口语化需求精准切分为隔离并行的 DAG 任务堆栈
argument-hint: '<待分解的模块或 Epic>'
allowed-tools: Read, Write
---

# /fusion-task - DAG 任务碎片化爆破

这是连接 Stage 1 (系统设计) 与 Stage 5 (多兵营并发) 之间的战略桥梁。

## 执行动作

1. 读取现有的 `pipeline/2_planning/task.md` (如有)。
2. 扮演 `lead` 角色，分析 Commander 传达的开发目标。
3. **切碎与隔离分配**：
   - 彻底将目标打碎为多个相互毫不干涉的子任务。
   - **强制绑定兵种**：每一行任务前必须打上具体兵种之一，绝对不允许出现”开发组件”这种宽泛说法。
   - **禁止 Phase 闸门**：每个 Task 的 Blocker 字段是唯一调度依据。Phase 分组仅为视觉组织，不得添加”Phase X 全部完成后解封”等闸门语句。任务解锁 = 自身 Blocker 全部完成，不等同 Phase 无关任务。
   - 示例：`- [ ] T-01 (\`fe-ui-builder\`): 纯函数构建购物列表卡片 (Blocker: None)`
4. 将重构后的 DAG 树覆盖写入 `pipeline/2_planning/task.md`。
