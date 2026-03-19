<!-- Author: PM -->

Feature: 流式输出 (Streaming)

  # F1.1 — 发送端流式语义提取
  Scenario: [Happy Path] 发送端逐段获取语义提取结果
    Given 用户输入了一条消息
    When 发送端开始提取语义
    Then 语义意图和文化背景说明逐段返回
    And 最终结果与非流式模式一致

  # F1.1 — 发送端流式语义提取
  Scenario: [Error Case] 流式提取中途断开
    Given 发送端正在流式提取语义
    When 连接意外中断
    Then 系统报告提取失败，提示具体错误原因
    And 不生成残缺的信封

  # F1.2 — 接收端流式文化适配
  Scenario: [Happy Path] 接收端逐字显示适配文本
    Given 接收端收到一条包含有效信封的消息
    When 开始文化适配
    Then 适配文本逐字生成并实时返回
    And 用户在首字节返回后立即看到文本开始出现

  # F1.2 — 接收端流式文化适配
  Scenario: [Error Case] 适配过程中模型返回空内容
    Given 接收端正在流式适配
    When 模型返回空响应
    Then 系统报告适配失败
    And 通知发送方适配未成功

  # F1.3 — 路由服务器流式转发
  Scenario: [Happy Path] 路由服务器透传流式响应
    Given 发送方通过路由服务器发送消息
    When 目标 Agent 开始流式响应
    Then 路由服务器将每个数据块逐一转发给发送方
    And 发送方收到的数据块顺序与目标 Agent 发送顺序一致

  # F1.3 — 路由服务器流式转发
  Scenario: [Error Case] 流式转发超时
    Given 路由服务器正在转发流式响应
    When 超过 120 秒未收到新数据块
    Then 路由服务器终止转发并返回超时错误
    And 已转发的部分数据保留在发送方

  # F1.4 — CLI 逐字显示
  Scenario: [Happy Path] 终端逐字打印适配文本
    Given Agent 在命令行运行中
    When 收到一条流式适配响应
    Then 终端逐字打印适配后的文本，无需等待完整响应

  # F1.4 — CLI 逐字显示
  Scenario: [Error Case] 流式响应中途中断
    Given 终端正在逐字显示
    When 流式数据中途中断
    Then 已显示的文本保留
    And 显示错误提示，不擦除已有内容

Feature: Web Demo UI

  # F2.1 — 双栏对话界面
  Scenario: [Happy Path] 打开演示页面看到双栏布局
    Given 用户在浏览器打开 demo 页面
    When 页面加载完成
    Then 左栏显示 zh-CN Agent 标识和输入框
    And 右栏显示 ja Agent 标识和输入框

  # F2.1 — 双栏对话界面
  Scenario: [Error Case] 后端服务未启动时打开页面
    Given 路由服务器和 Agent 均未启动
    When 用户打开 demo 页面
    Then 页面显示连接状态为"未连接"
    And 输入框禁用，提示用户先启动服务

  # F2.2 — 信封元数据展示面板
  Scenario: [Happy Path] 查看消息的信封元数据
    Given 对话中已有一条消息
    When 用户点击该消息的"查看详情"按钮
    Then 展开显示语义意图、文化背景说明、意图类型、正式度、情感基调
    And 文化背景说明以原始语言显示（中文写中文，日文写日文）

  # F2.2 — 信封元数据展示面板
  Scenario: [Error Case] 信封缺少可选字段
    Given 消息的信封中 cultural_context 缺失
    When 用户查看该消息的元数据
    Then cultural_context 显示为"（无）"
    And 其他字段正常展示

  # F2.3 — 一键启动 demo 脚本
  Scenario: [Happy Path] 一键启动全部服务
    Given 用户在项目根目录
    When 运行启动命令
    Then 路由服务器启动
    And 两个 Agent（zh-CN 和 ja）启动并自动注册
    And Web 服务器启动，浏览器自动打开 demo 页面

  # F2.3 — 一键启动 demo 脚本
  Scenario: [Error Case] 端口被占用
    Given 路由服务器的端口已被其他程序占用
    When 运行启动命令
    Then 报告端口冲突错误，显示被占用的端口号
    And 不启动任何服务（避免部分启动的状态）

  # F2.4 — 实时消息流显示
  Scenario: [Happy Path] 对方栏位实时显示适配文本
    Given zh-CN Agent 发送了一条消息
    When ja Agent 开始流式适配
    Then ja 栏位实时逐字显示适配后的文本
    And zh-CN 栏位显示发送状态为"对方正在接收"

  # F2.4 — 实时消息流显示
  Scenario: [Error Case] 适配失败时的界面反馈
    Given zh-CN Agent 发送了一条消息
    When ja Agent 适配失败
    Then ja 栏位显示"适配失败"错误提示
    And zh-CN 栏位显示发送状态为"对方处理失败"

Feature: 多轮对话上下文

  # F3.1 — Agent 对话历史维护
  Scenario: [Happy Path] 连续发送多条消息后历史累积
    Given Agent A 和 Agent B 已建立对话
    When Agent A 连续发送 3 条消息
    Then Agent A 的对话历史包含 3 条发送记录
    And Agent B 的对话历史包含 3 条接收记录

  # F3.1 — Agent 对话历史维护
  Scenario: [Error Case] 对话历史超过上限自动截断
    Given 对话历史已有 10 轮（达到上限）
    When Agent A 发送第 11 条消息
    Then 最早的一轮被移除，历史保持 10 轮
    And 被移除的内容不影响当前适配质量

  # F3.2 — 适配时注入近 N 轮上下文
  Scenario: [Happy Path] 适配结果引用前文语境
    Given Agent A 第一条消息提到"明天的会议"
    And Agent A 第二条消息说"那件事就按你说的办"
    When 接收端适配第二条消息
    Then 适配结果能正确理解"那件事"指的是"明天的会议"

  # F3.2 — 适配时注入近 N 轮上下文
  Scenario: [Error Case] 无历史上下文时正常降级
    Given 这是对话的第一条消息（无历史）
    When 接收端适配该消息
    Then 适配正常完成，与 Phase 1 行为一致
    And 无报错

  # F3.3 — 信封 v0.3 对话追踪字段
  Scenario: [Happy Path] 信封包含对话标识和轮次
    Given Agent A 在同一对话中发送第 3 条消息
    When 生成信封
    Then 信封包含对话标识（同一对话的所有消息相同）
    And 信封包含轮次编号 3

  # F3.3 — 信封 v0.3 对话追踪字段
  Scenario: [Error Case] 收到 v0.2 信封时向后兼容
    Given 接收端收到一个 v0.2 信封（不含对话标识和轮次）
    When 解析该信封
    Then 解析成功，对话标识和轮次视为空
    And 适配流程正常执行，不因缺少字段报错
