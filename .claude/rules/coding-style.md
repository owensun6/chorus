# Fusion-Core 第一性代码规范 (Code Style & Standards)

所有受派于 Fusion-Core 的代码输出 Agent 均须恪守以下强约束。如果输出结果打破了这些边界，`QA-01` Reviewer 将予以红牌阻断。

## 1. 永恒不变性 (Immutability Principle)

避免一切副作用。

- 绝不允许声明 `let` 变量（除非是为了极端的性能迭代如 `for-loops`）。
- 使用高防副作用的纯函数 (Pure Functions)。
- 对象操作严禁覆盖：必须始终返回新的克隆对象（如 `{...oldState, val: 1}`）。

## 2. 空间复杂度压制 (File Size Limits)

任何过厚的文件都是大模型认知幻觉的重灾区。

- **单个文件/组件行数**: `MAX_LINES: 300`。一旦代码探测接近 400 行，要求立即中止重构并拆分为子级组件。
- **单个函数行数**: 严厉限制在 40 行内。如果逻辑庞大，提炼出 `private` 私有工具方法。

## 3. 错误捕获隔离墙 (Fault Containment)

绝不能放任“报错爆炸”到用户视图。

- 所有的外部 I/O (数据库、网络请求、文件系统) 必须用 `try-catch` 包裹。
- 必须遵循**统一降级规范**: 任何崩溃不仅要有 Error 日志追踪，对前端端点必须返回友好的通用降级消息（如 `500 Internal Server Error` 以及 Trace ID 供追溯）。

## 4. 零信任输入验证 (Zero-Trust Input Validation)

不要相信宇宙中的任何输入源，甚至包括上游系统。

- 后端 Controller 入口必须强制执行 `Zod` 或 `Joi` Schema 验证。
- 缺失入参校验的代码是**安全零容忍**的，直接作降级打回处理。
