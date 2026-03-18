---
description: 【中控战报】宣读当前阶段的物理看板、覆盖率与阻断记录
argument-hint: ''
allowed-tools: Bash, Read
---

# /fusion-status - 联合战况宣读

提供一种极其硬核、真实的数据化项目进度快报。

## 执行动作

1. **侦察数据抓取**：
   - 查看 `pipeline/monitor.md`，提炼当前的 Stage 进度。
   - 执行 `npm run test:coverage` (或直接读取 coverage/lcov-report) 抓取真正的物理测试覆盖率。
   - 执行 `git status` 看当前分支是否存在脏代码或未缓存修改。
2. **大屏报读**：汇总上述客观事实：
   - “Commander，目前项目游标停在 [Stage 3]。”
   - “全库 TDD 代码覆盖率为 [X%]，低于我们 80% 的红线底牌 / 安全。”
   - “有 3 个未签名或未测试的文件散落在沙箱中。”
