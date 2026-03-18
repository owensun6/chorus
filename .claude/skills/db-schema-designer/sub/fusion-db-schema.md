---
name: fusion-db-schema
description: db-schema-designer 专用。编写 ORM Schema、数据库迁移脚本、高性能索引策略，TDD RED→GREEN→REFACTOR。
---

# fusion-db-schema — 数据库 Schema 设计


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 实体定义转化为 Schema+迁移脚本
2. **这些步骤已经不可原子级再分了吗？**
   → Schema 定义 → 迁移脚本 → 索引策略 → Schema 测试，每步独立不跳过。

---

## 输入文件

| 文件                                            | 用途                             |
| ----------------------------------------------- | -------------------------------- |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 本任务验收标准                   |
| `pipeline/1_architecture/Data_Models.md`        | 实体定义、字段规格、并发保护方案 |

---

## TDD 执行循环

### 🔴 RED: 从 BDD 生成 Schema 验证测试

**⚠️ TDD 证据链（铁律）**:

1. 读取 TASK_SPEC 中的 BDD 验收标准（Given-When-Then），逐条转化为测试断言
2. 运行测试 → **必须全部 FAIL**（若有 PASS = 实现已存在，上报 Lead）
3. `git commit -m "test(red): T-{ID} [简述]"` — 此 commit 是 RED 的物理证据
4. QA-01 将验证 git log 中 `test(red)` commit 早于 `feat(green)` commit

**未提交 RED commit 就写实现代码 = 违反 TDD 纪律，QA-01 将直接 FAIL。**

```ts
// 验证 Schema 完整性
describe('User Schema', () => {
  it('成功创建用户记录', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'user',
      },
    });
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeDefined();
  });

  it('email 唯一约束生效', async () => {
    await prisma.user.create({ data: { email: 'dup@test.com', passwordHash: 'h', role: 'user' } });
    await expect(
      prisma.user.create({ data: { email: 'dup@test.com', passwordHash: 'h', role: 'user' } }),
    ).rejects.toThrow('Unique constraint');
  });

  it('必填字段缺失时抛出错误', async () => {
    await expect(
      prisma.user.create({ data: { email: 'test2@example.com' } as any }),
    ).rejects.toThrow();
  });
});
```

### 🟢 GREEN: 编写 Prisma Schema → `git commit -m "feat(green): T-{ID} [简述]"`

```prisma
// 严格对照 Data_Models.md
// 每个字段必须有来源 Data_Models 的对应条目

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(user)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  version      Int      @default(0) // 乐观锁字段（Data_Models.md 要求）

  @@index([email])         // 登录查询高频
  @@index([createdAt])     // 时间范围查询
}

enum Role {
  user
  admin
}
```

**索引策略原则**:

- 高频 `WHERE` 查询字段加索引
- 唯一约束字段自动建索引
- 超大表的范围查询字段加复合索引
- 索引不是越多越好（写入性能代价）

### 🔵 REFACTOR: 清理

- 添加字段注释（说明来源 Data_Models.md 对应条目）
- 验证迁移脚本幂等性（可重复执行）

---

## 迁移脚本规范

```bash
# 生成迁移
npx prisma migrate dev --name "add_user_table"

# 生产环境执行
npx prisma migrate deploy
```

**命名规范**: `{timestamp}_{动作}_{表名}` — 例如 `20260301_add_user_table`

---

## 完成条件

- [ ] Schema 包含 Data_Models.md 中所有字段和约束
- [ ] 迁移脚本可成功执行（`prisma migrate dev` 无报错）
- [ ] 并发保护字段已添加（如 version 乐观锁）
- [ ] 高频查询字段有索引

**完成后 → 在 monitor.md 标记 `[x]` → 调用 code-simplifier → 进入 QA 轮询循环。**
