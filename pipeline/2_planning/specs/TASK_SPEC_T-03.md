<!-- Author: Lead -->

# TASK_SPEC T-03: 信封创建/验证模块

**Assignee**: be-domain-modeler
**Blocker**: T-01
**F-ID**: F1

## 目标

实现 Chorus 信封的创建、验证和解析逻辑。

## 交付物

- `src/envelope.ts` — createEnvelope(), parseEnvelope(), validateEnvelope()
- `tests/envelope.test.ts` — 单元测试

## 验收命令

```bash
npx jest tests/envelope.test.ts --coverage
# exit 0 = 通过，覆盖率 ≥ 80%
```

## 约束

- createEnvelope(): 接收语义意图 + 文化标识 + 可选字段 → 返回合法信封对象
- parseEnvelope(): 从 A2A Message parts 数组中按 mediaType 查找 Chorus DataPart → 返回信封或 null
- validateEnvelope(): 用 T-01 的 Zod Schema 校验 → 返回 success/error
- 纯函数，不可变，无副作用
