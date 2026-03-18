---
description: 【上交前提】模拟人类发出 `git commit` 前的极细颗粒度自我验收
argument-hint: ''
allowed-tools: Bash, Grep
---

# /fusion-self-check - 人工智能静电网前置自检

不要等真正的 Husky 在 `pre-commit` 把你骂得狗血淋头。你要有自尊心，先查自己。

## 执行动作

针对你刚才修改过的一切源文件（尤其是 `src/`, `pipeline/` 下）：

1. **查验签名**：用 `grep` 搜索第一行有没有 `<Author: xxx>`。
2. **查验可变状态**：文件中是否引入了 `let`，如果有，你自己必须想办法重构为纯函数或者 `const`。
3. **跑死锁链**：自动执行 `npm run lint` 和 `npm run test`。
4. 如果通过，生成一张 **全绿护签单** 交给 Commander，这代表代码完全物理合规。
