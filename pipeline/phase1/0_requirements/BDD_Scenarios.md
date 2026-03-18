<!-- Author: PM -->

# Chorus Protocol — Phase 1 BDD Scenarios

---

Feature: Chorus 语义信封 v0.2

  # F1v2 — 信封含 cultural_context
  Scenario: [Happy Path] Agent 发送包含 cultural_context 的 v0.2 信封
    Given Agent A 代表中文用户，已向路由服务器注册
    And Agent B 代表日文用户，已向路由服务器注册
    When 中文用户输入"你怎么这么胖？应该多运动。"
    And Agent A 调用 LLM 提取语义意图并生成 cultural_context
    Then 信封包含 chorus_version="0.2"
    And 信封包含 original_semantic（语义意图描述）
    And 信封包含 sender_culture="zh-CN"
    And 信封包含 cultural_context（如"中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意"）
    And 信封作为 A2A DataPart 携带，mediaType="application/vnd.chorus.envelope+json"

  # F1v2 — 信封格式校验
  Scenario: [Error Case] 信封缺少必填字段
    Given Agent A 生成了一条信封，但缺少 original_semantic 字段
    When Agent B 收到此信封
    Then Agent B 返回格式错误响应，标明缺少哪个必填字段
    And 对话不中断，Agent A 可补充后重发

---

Feature: Agent Card 文化扩展 v0.2

  # F2v2 — Agent Card 配对
  Scenario: [Happy Path] 两个 Agent 确认 Chorus 协议兼容
    Given Agent A 的 Card 声明 Chorus 扩展：user_culture="zh-CN", supported_languages=["zh-CN","en"]
    And Agent B 的 Card 声明 Chorus 扩展：user_culture="ja", supported_languages=["ja","en"]
    When Agent A 通过路由服务器获取 Agent B 的 Card
    Then Agent A 确认 Agent B 支持 Chorus 扩展
    And Agent A 确认自身能处理 ja 语言
    And 对话以 Chorus 模式建立

---

Feature: 文化适配提示词模板 v0.2

  # F3v2 — cultural_context 生成
  Scenario: [Happy Path] 发送方 Agent 按推荐指引生成 cultural_context
    Given Agent A 使用推荐的 cultural_context 生成提示词
    When 用户输入"我摸一下你的头"
    Then Agent A 的 LLM 生成 cultural_context，描述此行为在中国文化中的含义
    And cultural_context 内容为中文自然语言（与 sender_culture 对应），长度 10-500 字符
    And cultural_context 被写入信封的 cultural_context 字段

  # F3v2 — cultural_context 生成失败
  Scenario: [Error Case] LLM 未能生成 cultural_context
    Given Agent A 调用 LLM 生成 cultural_context
    When LLM 返回空字符串或调用超时
    Then Agent A 仍然发送信封，但不含 cultural_context 字段
    And 信封退化为 v0.1 级别（仅 sender_culture BCP47 代码）
    And Agent A 本地日志记录 WARNING "cultural_context generation failed, sending without it"

  # F3v2 — 接收端适配
  Scenario: [Happy Path] 接收方 Agent 利用 cultural_context 进行文化适配
    Given Agent B 收到信封，其中 cultural_context="在中国文化中摸头是长辈对晚辈的亲昵表达"
    And sender_culture="zh-CN"
    When Agent B 调用 LLM 进行文化适配
    Then 输出不是逐字翻译，而是考虑了日本文化中头部触碰的含义
    And 输出保留原始沟通意图（亲近表达）
    And 输出的文化适当性 ≥ 3 分（5 分制）

---

Feature: Chorus 路由服务器 — Agent 注册与发现

  # F5 — Agent 注册
  Scenario: [Happy Path] Agent 向路由服务器注册
    Given Chorus 路由服务器正在运行
    When Agent A 发送 POST /agents，body 含 { agent_id, endpoint, agent_card }
    Then 服务器返回 201 Created
    And Agent A 的信息存储在内存中
    And Agent A 出现在 GET /agents 列表中

  # F5 — Agent 发现
  Scenario: [Happy Path] Agent 查询可用对话伙伴
    Given Agent A 和 Agent B 均已注册
    When Agent A 发送 GET /agents
    Then 返回包含 Agent B 的列表（含 agent_id 和 Agent Card 摘要）
    When Agent A 发送 GET /agents/{agent_b_id}
    Then 返回 Agent B 的完整 Agent Card（含 Chorus 扩展）

  # F5 — 注册请求格式错误
  Scenario: [Error Case] 注册请求 body 格式错误
    Given Chorus 路由服务器正在运行
    When 发送 POST /agents，body 为无效 JSON 或缺少 agent_id 字段
    Then 服务器返回 400 Bad Request
    And 响应 body 含 { success: false, error: { code: "ERR_INVALID_BODY", message: "..." } }
    And 服务器注册表不受影响

  # F5 — Agent 注销
  Scenario: [Cleanup] Agent 退出时注销
    Given Agent A 已注册
    When Agent A 进程退出，发送 DELETE /agents/{agent_a_id}
    Then 服务器返回 200 OK
    And Agent A 从 GET /agents 列表中移除
    And 后续发送给 Agent A 的消息返回 404

  # F5 — 重复注册
  Scenario: [Idempotent] Agent 重复注册更新信息
    Given Agent A 已注册，endpoint="http://localhost:3001"
    When Agent A 再次 POST /agents，endpoint 改为"http://localhost:3002"
    Then 服务器返回 200 OK
    And Agent A 的 endpoint 更新为新值

---

Feature: Chorus 路由服务器 — 消息转发

  # F6 — 消息转发
  Scenario: [Happy Path] 路由服务器转发 Chorus 消息
    Given Agent A 和 Agent B 均已注册
    And Agent B 的 endpoint 为 "http://localhost:3002/receive"
    When Agent A 发送 POST /messages，body 含 { target_agent_id: "agent-b", message: <A2A Message with Chorus DataPart> }
    Then 路由服务器查找 Agent B 的 endpoint
    And 路由服务器 HTTP POST 完整消息到 Agent B 的 endpoint
    And 返回 Agent B 的响应给 Agent A

  # F6 — 目标 Agent 不存在
  Scenario: [Error Case] 目标 Agent 未注册
    Given Agent A 已注册，Agent C 未注册
    When Agent A 发送 POST /messages，target_agent_id="agent-c"
    Then 路由服务器返回 404 Not Found
    And 错误消息标明 agent-c 未注册

  # F6 — 消息请求格式错误
  Scenario: [Error Case] 消息转发请求 body 格式错误
    Given Agent A 已注册
    When Agent A 发送 POST /messages，body 缺少 target_agent_id 或 message 字段
    Then 路由服务器返回 400 Bad Request
    And 响应含 { success: false, error: { code: "ERR_INVALID_BODY", message: "missing required field: target_agent_id" } }

  # F6 — 目标 Agent endpoint 不可达
  Scenario: [Error Case] 目标 Agent 已注册但 endpoint 不可达
    Given Agent A 和 Agent B 均已注册
    And Agent B 的 endpoint HTTP 服务已关闭
    When Agent A 发送 POST /messages，target_agent_id="agent-b"
    Then 路由服务器尝试转发到 Agent B 的 endpoint
    And HTTP POST 超时或连接被拒
    Then 路由服务器返回 502 Bad Gateway
    And 响应含 { success: false, error: { code: "ERR_AGENT_UNREACHABLE", message: "target agent endpoint unreachable" } }

  # F6 — 同时发送（已知限制）
  Scenario: [Known Limitation] 两个用户同时发送消息
    Given Agent A 和 Agent B 均已注册且在对话中
    When 两个用户同时发送消息（两个 POST /messages 几乎同时到达）
    Then 两条消息均被路由服务器独立转发（不保证到达顺序）
    And 不丢消息——两条消息最终都到达对方 Agent
    And Agent CLI 显示可能交错（先显示对方消息再显示自己的发送确认，或反之）

  # F6 — 纯透传
  Scenario: [Invariant] 路由服务器不修改消息内容
    Given Agent A 发送一条包含 Chorus DataPart 的消息
    When 路由服务器转发给 Agent B
    Then Agent B 收到的消息与 Agent A 发送的完全一致
    And 路由服务器未解析、修改或删除任何 DataPart 内容

---

Feature: 参考 Agent 实现

  # F7 — 端到端对话
  Scenario: [Happy Path] 中日双 Agent 端到端对话
    Given 路由服务器已启动
    And zh-CN Agent 已启动并注册
    And ja Agent 已启动并注册
    When 中文用户在 zh-CN Agent CLI 输入"能不能帮我约个时间聊聊？"
    Then zh-CN Agent 生成 Chorus v0.2 信封（含 cultural_context）
    And 信封通过路由服务器转发到 ja Agent
    And ja Agent 解析信封，调用 LLM 进行日文文化适配
    And 日文用户看到适配后的日文输出（非逐字翻译）
    And 日文用户可以输入回复，反向执行同样流程

  # F7 — Agent 启动自注册
  Scenario: [Happy Path] Agent 启动后自动注册
    Given 路由服务器已启动
    When 用户运行 `npx chorus-agent --culture zh-CN --port 3001`
    Then Agent 自动向路由服务器 POST /agents 注册
    And Agent 开始监听用户 CLI 输入
    And Agent 开始监听 endpoint 端口接收消息

