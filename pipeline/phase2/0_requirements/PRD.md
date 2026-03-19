<!-- Author: PM -->

project: Chorus Protocol Phase 2
compiled_from: "Phase 2 需求：1) Streaming 流式输出 — LLM 调用改为流式，路由服务器和 Agent 端支持 SSE/streaming 透传，CLI 逐字显示适配文本。2) Web Demo UI — 可视化两个 Agent 的对话过程，左右分栏显示 zh-CN 和 ja Agent 视角，展示信封元数据（cultural_context、intent_type 等），一键启动 demo。3) 多轮对话上下文 — Agent 维护对话历史，LLM 适配时注入近 N 轮上下文，信封中新增 conversation_id 和 turn_number 字段追踪对话。"
status: PENDING_GATE_0

---

## 1. 业务背景

Phase 1 交付了可工作的 Chorus Protocol（路由服务器 + Agent CLI + 信封 v0.2），E2E 验证证明跨文化适配有效（ja→zh-CN: "つまらないものですが" → "一点心意，不成敬意，请您收下"）。

但 Phase 1 存在三个体验缺口：

1. **感知延迟不可接受**: LLM 单次调用 30-60 秒，用户在空白界面等待，无法感知系统是否在工作。流式输出是标准解法——逐字显示消除等待焦虑。
2. **无法演示**: CLI 终端不适合向非技术人员展示跨文化适配效果。需要可视化界面，左右分栏对比两个文化视角，展示信封元数据（cultural_context 是核心卖点）。
3. **对话不自然**: 每条消息独立处理，LLM 没有前文语境。真实对话中第三句和第一句有逻辑关系，缺少上下文会导致适配质量下降。

## 2. 用例清单 (Use Cases)

### UC-01: 流式对话（主流程）

用户在界面输入消息 → 发送端 Agent 流式提取语义和文化背景 → 信封通过路由服务器转发 → 接收端 Agent 流式适配 → 用户逐字看到适配后的文本出现。

### UC-02: Web Demo 演示

演示者打开浏览器，一键启动 demo → 左栏显示 zh-CN Agent 视角，右栏显示 ja Agent 视角 → 发送消息后，两侧同时显示原文和适配结果 → 信封元数据面板展示 cultural_context、intent_type 等字段。

### UC-03: 多轮上下文对话

用户连续发送多条消息 → 系统自动维护对话历史 → 第 N 条消息的适配结果能引用前几轮的语境（如第一条提到"会议"，第三条说"那件事"时 LLM 能理解指的是会议）。

### UC-04: 对话历史超出窗口

对话持续超过 N 轮 → 系统自动截断最早的消息，只保留最近 N 轮 → 适配质量不因截断而崩溃（降级而非报错）。

## 3. 非功能性需求

- 首字节时间 (TTFB): 流式输出的首字节应在 LLM 返回第一个 token 后立即可见（<100ms 透传延迟）
- 并发量: Phase 2 仍为 demo 级别，2 个 Agent 同时在线
- 浏览器兼容: Web UI 支持 Chrome/Safari/Firefox 最新版
- 对话历史上限: N=10 轮（可配置），内存存储，重启即清空

## 4. 假设登记表（Commander 需确认）

| ID | 假设描述 | 维度 | 依据来源 | 影响(H/M/L) | 风险(H/M/L) | Commander 确认 |
|----|---------|------|---------|------------|------------|---------------|
| A-P2-01 | Dashscope OpenAI 兼容端点支持 streaming（stream: true 参数） | Viability | OpenAI SDK 文档 | H | L | |
| A-P2-02 | 路由服务器可以流式透传 Agent 响应（chunked transfer 或 SSE） | Viability | Hono 框架能力 | H | M | |
| A-P2-03 | 10 轮对话历史足够 LLM 理解上下文（不超出 token 窗口） | Value | qwen3.5-plus 128K context | M | L | |
| A-P2-04 | 信封 v0.3 新增字段（conversation_id, turn_number）向后兼容 v0.2（additionalProperties: true 保证） | Viability | Phase 1 Schema 设计 | H | L | |
| A-P2-05 | 单页 HTML + 内联 JS 足够实现 demo UI（无需 React/Vue 框架） | Usability | MVP 原则 | M | L | |
| A-P2-06 | 流式输出场景下，路由服务器不需要缓存完整响应即可开始转发 | Viability | HTTP chunked transfer 规范 | H | M | |
