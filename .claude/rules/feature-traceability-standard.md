# 功能追踪矩阵规范 (Feature Traceability Standard)

> **[!] CRITICAL**: FEATURE_LIST.md 是项目的追踪脊柱。从需求到验收，每个功能的全生命周期在此文件中可视化追踪。任何 F-ID 在任何阶段被遗漏 = 验收风险。

## 1. 追踪总表格式

FEATURE_LIST.md 顶部必须包含追踪总表，每个子功能 F-ID 一行：

```markdown
| F-ID | 功能名称 | PM | 原型 | 接口 | Task | 实现 | QA | 验收 |
|------|---------|-----|------|------|------|------|-----|------|
| F1.1 | [描述]  | ✅  | S-03 | API-2| T-04 | ✅   | ✅  | ⬜   |
```

## 2. 列更新责任

| 列 | 角色 | 阶段 | 填写内容 |
|----|------|------|---------|
| PM | PM | Stage 0 | ✅（确认功能纳入） |
| 原型 | UX Designer | Stage 0.5 | 屏幕编号（Feature_Screen_Map 中的 S-xx） |
| 接口 | Lead | Stage 1 | INTERFACE.md 中的接口编号 |
| Task | Lead | Stage 3 | task.md 中的 T-ID |
| 实现 | Lead | Stage 7 | ✅（基于 task.md 完成状态） |
| QA | Lead | Stage 7 | ✅ / ✗（基于 Gate 3 审计结果） |
| 验收 | Commander | Stage 7 | ✅（人工最终签字） |

## 3. 铁律

1. **零遗漏**: 每个 F-ID 必须在追踪总表中有一行。PM 创建时初始化，后续阶段只更新列值
2. **只增不删**: F-ID 一旦写入，只能标记状态，不能删除行。需求变更必须通过 Commander 审批
3. **覆盖率检查**: Gate 0.5 时 UX 验证"原型"列覆盖率 100%；Gate 1 时 Lead 验证"接口"列覆盖率 100%
4. **验收依据**: Commander 在 Stage 7 逐行检查追踪总表，全部 ✅ 才可标记项目验收通过
