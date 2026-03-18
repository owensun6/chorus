---
name: fusion-ui-build
description: fe-ui-builder 专用。按 UI_CONTRACT 构建展示型哑组件，TDD RED→GREEN→REFACTOR。
---

# fusion-ui-build — 前端 UI 哑组件构建


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 构建 UI 哑组件壳子
2. **这些步骤已经不可原子级再分了吗？**
   → RED（先写测试）→ GREEN（最简实现）→ REFACTOR（清理代码），三步不可合并，不可颠倒。

---

## 输入文件

| 文件                                            | 用途                                           |
| ----------------------------------------------- | ---------------------------------------------- |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 本任务的验收标准                               |
| `pipeline/0_5_prototype/UI_CONTRACT.md`         | 组件规格（状态/布局/交互规则）+ Design Token   |
| `pipeline/0_5_prototype/Wireframes/`            | 视觉参考                                       |
| `pipeline/0_5_prototype/stitch-code/` (可选)    | Stitch 生成的 HTML+Tailwind 起点骨架，优先复用 |

---

## TDD 执行循环

### 🔴 RED: 从 BDD 生成失败测试

**⚠️ TDD 证据链（铁律）**:

1. 读取 TASK_SPEC 中的 BDD 验收标准（Given-When-Then），逐条转化为测试断言
2. 运行测试 → **必须全部 FAIL**（若有 PASS = 实现已存在，上报 Lead）
3. `git commit -m "test(red): T-{ID} [简述]"` — 此 commit 是 RED 的物理证据
4. QA-01 将验证 git log 中 `test(red)` commit 早于 `feat(green)` commit

**未提交 RED commit 就写实现代码 = 违反 TDD 纪律，QA-01 将直接 FAIL。**

```tsx
// 示例: 登录表单组件快照测试
import { render } from '@testing-library/react';
import LoginForm from './LoginForm';

test('renders login form with all required elements', () => {
  const { getByPlaceholderText, getByRole } = render(<LoginForm />);

  expect(getByPlaceholderText('example@email.com')).toBeInTheDocument();
  expect(getByPlaceholderText('请输入密码')).toBeInTheDocument();
  expect(getByRole('button', { name: '登录' })).toBeInTheDocument();
  expect(getByRole('button', { name: '登录' })).toBeDisabled(); // 初始禁用
});
```

**确认测试失败（红灯）后才可写实现代码。**

### 🟢 GREEN: 最简实现（哑组件） → `git commit -m "feat(green): T-{ID} [简述]"`

```tsx
// 组件规则:
// 1. 只有 UI 结构，不调用任何 API
// 2. 所有动态数据通过 props 传入（留好接口供 fe-logic-binder）
// 3. 使用 Tailwind CSS，符合 UI_CONTRACT 布局规格
// 4. 包含 UI_CONTRACT 中定义的所有状态变体

interface LoginFormProps {
  onSubmit?: (email: string, password: string) => void;
  isLoading?: boolean;
  errorMessage?: string;
}

export default function LoginForm({ onSubmit, isLoading = false, errorMessage }: LoginFormProps) {
  // 最简实现，让测试变绿
}
```

**确认测试通过（绿灯）后才可重构。**

### 🔵 REFACTOR: 清理

- 代码行数 < 200 行（超出则拆分子组件）
- 无 `console.log` 残留
- 无硬编码文本（可维护性）
- 组件名符合 UI_CONTRACT 中的组件 ID 命名

---

## 禁区（越界即违规）

- ❌ 禁止跳过测试直接写实现

---

## 完成条件

- [ ] 所有测试绿灯
- [ ] 组件包含 UI_CONTRACT 中定义的所有状态变体
- [ ] WCAG 可访问性基本合规（aria-label / role 属性）
- [ ] 零 API 调用（Props 接口已预留）

**完成后 → 在 monitor.md 标记 `[x]` → 调用 code-simplifier → 进入 QA 轮询循环。**
