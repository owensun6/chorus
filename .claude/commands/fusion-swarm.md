---
description: 启动并发 Agent 兵团调度 (Fusion-Core 专有物理版)
argument-hint: '<13兵种名称> "任务1" <13兵种名称> "任务2"'
allowed-tools: Bash
---

# /fusion-swarm - 并发 Agent 战术空投

当你拥有多个相互独立且可并行的开发任务，并且需要在 `fusion-core` 物理隔离架构下运行时，使用此指令。

## 运作原理与使用要求

**强烈警告**：与普通的 `swarm` 不同，`fusion-swarm` 强制要求传入合法的 13 兵种名（如 `fe-ui-builder`, `be-api-router` 等）。它将调用本地的物理路由器脚本，强制隔离兵种的系统提示词，防止大模型上下文幻觉。

### 调度格式

```bash
/fusion-swarm be-domain-modeler "构建 Zod Schema" fe-ui-builder "构建购物车纯函数 UI 组件"
```

### 执行步骤（请严格执行）

1. 识别目标兵种列表与分别对应的短句。
2. 你绝不可以直接在当前文件内写代码！
3. 请通过执行工具，分别为每个特种兵调用底层原生 Node.js 路由器命令：
   - 示范执行：`npx fusion-router --role be-domain-modeler --task "构建 Zod Schema"`
4. 输出反馈：“✅ 战术空投完毕。所有底层特种兵进程已发送至后台处理隔离运行，请查阅 `tmux` 与物理分支。”
