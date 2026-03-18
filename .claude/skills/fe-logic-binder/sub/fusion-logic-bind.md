---
name: fusion-logic-bind
description: fe-logic-binder 专用。将 fe-ui-builder 的哑组件与 API/状态绑定，TDD RED→GREEN→REFACTOR。
---

# fusion-logic-bind — 前端逻辑绑定


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 为哑组件注入状态和 API 绑定
2. **这些步骤已经不可原子级再分了吗？**
   → 先写集成测试（模拟 API 响应）→ 注入状态逻辑 → 绑定 API → 验证行为正确。

---

## 输入文件

| 文件                                            | 用途                               |
| ----------------------------------------------- | ---------------------------------- |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 本任务验收标准                     |
| `pipeline/1_architecture/INTERFACE.md`          | 接口契约（endpoint/入参/响应格式） |
| `pipeline/0_5_prototype/UI_CONTRACT.md`         | 状态规则（初始/加载/成功/失败）    |

---

## TDD 执行循环

### 🔴 RED: 从 BDD 生成行为测试（Mock API 响应）

**⚠️ TDD 证据链（铁律）**:

1. 读取 TASK_SPEC 中的 BDD 验收标准（Given-When-Then），逐条转化为测试断言
2. 运行测试 → **必须全部 FAIL**（若有 PASS = 实现已存在，上报 Lead）
3. `git commit -m "test(red): T-{ID} [简述]"` — 此 commit 是 RED 的物理证据
4. QA-01 将验证 git log 中 `test(red)` commit 早于 `feat(green)` commit

**未提交 RED commit 就写实现代码 = 违反 TDD 纪律，QA-01 将直接 FAIL。**

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../mocks/server'; // MSW mock server
import { rest } from 'msw';
import LoginPage from './LoginPage';

test('成功登录后跳转到主界面', async () => {
  server.use(
    rest.post('/api/auth/login', (req, res, ctx) =>
      res(ctx.json({ success: true, data: { token: 'jwt123' } })),
    ),
  );

  const { getByPlaceholderText, getByRole } = render(<LoginPage />);

  fireEvent.change(getByPlaceholderText('example@email.com'), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(getByPlaceholderText('请输入密码'), {
    target: { value: 'password123' },
  });
  fireEvent.click(getByRole('button', { name: '登录' }));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/dashboard');
  });
});
```

### 🟢 GREEN: 注入状态和 API 绑定 → `git commit -m "feat(green): T-{ID} [简述]"`

```tsx
// 规则:
// 1. 使用 UI_CONTRACT 中定义的状态机（与哑组件 props 对应）
// 2. API 调用严格遵循 INTERFACE.md 的接口规格
// 3. 不修改哑组件的 CSS/DOM 结构
// 4. 错误处理覆盖所有 INTERFACE.md 中定义的错误状态码

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (email: string, password: string) => {
    setStatus('loading');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      // 按 INTERFACE.md 处理响应...
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <LoginForm
      onSubmit={handleSubmit}
      isLoading={status === 'loading'}
      errorMessage={errorMessage}
    />
  );
}
```

### 🔵 REFACTOR: 清理

- 将复杂的状态逻辑提取为 custom hook（如 `useLoginForm`）
- 无 `console.log` 残留
- 防抖/节流已处理高频触发场景

---

## 完成条件

- [ ] 所有行为测试绿灯（含成功/失败/加载中状态）
- [ ] API 调用严格遵循 INTERFACE.md 规格
- [ ] UI_CONTRACT 中所有状态变体均有对应逻辑

**完成后 → 在 monitor.md 标记 `[x]` → 调用 code-simplifier → 进入 QA 轮询循环。**
