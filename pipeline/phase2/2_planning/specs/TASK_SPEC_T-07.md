<!-- Author: Lead -->
# TASK_SPEC_T-07
**任务**: Web Demo UI — 双栏对话界面 + 信封元数据 + SSE
**Assignee**: fe-ui-builder
**来源 F-ID**: F2.1, F2.2, F2.4
**Blocker**: None

## 输入
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 四 (Web Demo 接口: GET /events SSE 事件, POST /api/send)
- `pipeline/phase2/1_architecture/Data_Models.md` (SSEEvent, WebSendPayload)
- `pipeline/phase2/0_requirements/BDD_Scenarios.md` (F2.1, F2.2, F2.4 场景)

## 输出
- `src/web/index.html` — 新建 (单文件, HTML + 内联 CSS/JS, Tailwind CDN):
  - 布局: 响应式左右双栏 (mobile 时上下堆叠)
    - 左栏: zh-CN Agent 标识 + 消息列表 + 输入框 + 发送按钮
    - 右栏: ja Agent 标识 + 消息列表 + 输入框 + 发送按钮
  - SSE 连接: `new EventSource("/events")`, 监听 message_sent / adaptation_start / adaptation_chunk / adaptation_done / adaptation_error
  - 消息渲染:
    - 发送消息: 立即追加到本栏消息列表
    - adaptation_start: 对方栏显示 "正在适配..." 占位
    - adaptation_chunk: 逐字追加到占位元素
    - adaptation_done: 替换占位为完整消息, 附带可展开元数据面板
    - adaptation_error: 占位替换为错误提示
  - 元数据面板 (可折叠):
    - 显示: original_semantic, cultural_context, intent_type, formality, emotional_tone, conversation_id, turn_number
    - 缺失字段显示 "（无）"
  - 连接状态指示器: 顶部显示 SSE 连接状态 (connected / disconnected)
  - 发送: POST /api/send `{ from_agent_id, to_agent_id, text }`

## 验收标准（BDD 格式）
- Given 页面加载完成, When 查看布局, Then 左栏标题含 "zh-CN", 右栏标题含 "ja"
- Given SSE 连接正常, When 收到 adaptation_chunk 事件, Then 对应栏消息逐字更新
- Given 一条消息已完成适配, When 点击展开元数据, Then 显示信封全部字段
- Given cultural_context 缺失, When 展开元数据, Then 该字段显示 "（无）"
- Given SSE 连接断开, When 查看顶部状态, Then 显示 "未连接"
- Given 用户在左栏输入文本并点击发送, When 请求完成, Then 输入框清空, 消息出现在左栏列表

## 测试规格
- 无单元测试 (纯静态 HTML 文件)
- 验收命令: `npx html-validate src/web/index.html` (HTML 语法校验, exit 0 = 通过)

## 结构性约束测试
- immutability: N/A (浏览器 DOM 操作)
- error_handling: SSE onerror → 显示 disconnected 状态; fetch /api/send 失败 → 输入框下方显示错误
- input_validation: 发送前检查 text 非空; agent_id 硬编码为 "agent-zh-cn" / "agent-ja"

## 禁止事项
- 禁止引入 React/Vue/Svelte 等框架 (纯 HTML + 内联 JS)
- 禁止引入除 Tailwind CDN 外的 CSS 框架
- 禁止修改任何 src/ 下的 TypeScript 文件
- 禁止添加 Node.js 依赖
