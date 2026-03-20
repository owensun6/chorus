<!-- Author: PM -->
<!-- ⚠️ SUPERSEDED: 本文档已被 pipeline/PRD.md（统一 PRD v2.0）取代。保留为历史记录。 -->

Feature: Agent Personality 声明与人格感知适配

  # F1.1 — Agent 注册时声明人格描述
  Scenario: [Happy Path] Agent 注册时提供人格描述
    Given 路由服务器正在运行
    When Agent 注册并提供人格描述"热情直爽的北京大哥"
    Then 注册成功，返回确认响应
    And 该 Agent 的人格描述被保存

  # F1.1 — Agent 注册时声明人格描述
  Scenario: [Happy Path] Agent 注册时不提供人格描述（向后兼容）
    Given 路由服务器正在运行
    When Agent 注册但未提供人格描述
    Then 注册成功，返回确认响应
    And 该 Agent 的人格描述为空

  # F1.1 — Agent 注册时声明人格描述
  Scenario: [Error Case] 人格描述超过 200 字
    Given 路由服务器正在运行
    When Agent 注册并提供超过 200 字的人格描述
    Then 注册被拒绝，返回验证错误提示

  # F1.2 — 路由服务器在发现接口返回人格描述
  Scenario: [Happy Path] 发现接口返回含人格描述的 Agent 列表
    Given 已有一个 Agent 注册并设定了人格描述
    When 另一个 Agent 查询兼容 Agent 列表
    Then 返回的列表中包含该 Agent 的人格描述字段

  # F1.2 — 路由服务器在发现接口返回人格描述
  Scenario: [Error Case] 发现接口返回无人格描述的 Agent
    Given 已有一个 Agent 注册但未设定人格描述
    When 另一个 Agent 查询兼容 Agent 列表
    Then 返回的列表中该 Agent 的人格描述字段为空或缺失

  # F2.1 — 消息转发时附带发送方人格信息
  Scenario: [Happy Path] 路由转发消息时附带发送方人格
    Given 发送方 Agent 已注册并设定了人格描述"热情直爽的北京大哥"
    And 接收方 Agent 已注册
    When 发送方通过路由向接收方发送消息
    Then 接收方收到的转发请求中包含发送方的人格描述

  # F2.2 — 接收方 LLM 适配引用发送方人格
  Scenario: [Happy Path] 有人格描述时适配结果体现发送方风格
    Given 发送方人格为"热情直爽的北京大哥"
    And 发送方发送消息"你吃了吗？"
    When 接收方 Agent 做文化适配
    Then 适配结果中包含对发送方风格的感知（如提及对方说话方式热情直接）

  # F2.3 — 无人格描述时使用默认适配
  Scenario: [Happy Path] 无人格描述时按默认风格适配
    Given 发送方未设定人格描述
    And 发送方发送消息"你吃了吗？"
    When 接收方 Agent 做文化适配
    Then 适配结果与当前版本行为一致（默认朋友传话风格）

  # F2.3 — 无人格描述时使用默认适配
  Scenario: [Error Case] 发送方人格描述为空字符串时视为无人格
    Given 发送方注册时人格描述为空字符串
    When 接收方 Agent 做文化适配
    Then 系统按"无人格描述"处理，使用默认适配风格

  # F3.1 — Demo 差异化人格
  Scenario: [Happy Path] Demo 启动后两个 Agent 有不同人格
    Given Demo 启动完成
    When 查询已注册的 Agent 列表
    Then zh-CN Agent 有人格描述
    And ja Agent 有不同的人格描述
