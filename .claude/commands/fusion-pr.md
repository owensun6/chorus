---
description: 【封版投递】基于强规范组装上交审查的 Pull Request 提交流水
argument-hint: '<PR 的一句话摘要或关联的修复单号>'
allowed-tools: Read, Bash
---

# /fusion-pr - 强架构 PR 生产线

作为 `fusion-core` 的收尾网关，将完成的功能按规定格式封存。

## 执行动作

1. 前置拦截：调用 `npm run lint` 和 `npm run test`。如果有一丝报红，直接拒绝生产 PR，甩出错误日志打回重造。
2. 翻阅 `CHANGELOG.md` 获取最近的版本演进情况。
3. 如果项目下存在 `.github/ISSUE_TEMPLATE/`（例如 Bug Report），自动继承相关的填报精神。
4. 使用 `gh pr create` 或打印出纯文本 PR 正文，正文内必须明确声明：
   - 解决了哪些架构原子问题？
   - 有没有破坏原有纯函数的 Immutability？
   - E2E/单元测试的跑线保证截图/命令。
