<!-- Author: PM -->
<!-- ⚠️ SUPERSEDED: 本文档已被 pipeline/PRD.md（统一 PRD v2.0）取代。保留为历史记录。 -->

Feature: Chorus 路由服务器公网部署

  # F1.1 — API key 鉴权中间件
  Scenario: [Happy Path] 携带有效 API key 注册 Agent
    Given 路由服务器已启动且配置了 API key 列表
    When Agent 发送注册请求并携带有效的 Bearer token
    Then 注册成功，返回确认响应

  # F1.3 — 无效/缺失 token 返回 401
  Scenario: [Error Case] 未携带 token 注册 Agent
    Given 路由服务器已启动且配置了 API key 列表
    When Agent 发送注册请求但未携带 Authorization 头
    Then 返回 401 错误，提示"未授权"

  # F1.3 — 无效/缺失 token 返回 401
  Scenario: [Error Case] 携带无效 token 注册 Agent
    Given 路由服务器已启动且配置了 API key 列表
    When Agent 发送注册请求但 Bearer token 不在合法列表中
    Then 返回 401 错误，提示"未授权"

  # F1.2 — 写操作需携带 Bearer token
  Scenario: [Happy Path] 携带有效 token 发送消息
    Given 发送方和接收方均已注册
    When 发送方携带有效 token 通过路由发送消息
    Then 消息成功转发给接收方

  # F1.2 — 写操作需携带 Bearer token
  Scenario: [Happy Path] 查询 Agent 列表无需 token
    Given 路由服务器已启动且有已注册 Agent
    When 任何人发送 GET /agents 请求（无 token）
    Then 返回 Agent 列表，状态码 200

  # F2.1 — 健康检查端点
  Scenario: [Happy Path] 健康检查返回服务状态
    Given 路由服务器正在运行
    When 发送 GET /health 请求
    Then 返回 200 和服务状态信息（含版本号和运行时间）

  # F2.1 — 健康检查端点
  Scenario: [Error Case] 健康检查无需鉴权
    Given 路由服务器已启动且配置了 API key 列表
    When 发送 GET /health 请求（无 token）
    Then 仍然返回 200 和服务状态信息

  # F3.1 — 环境变量配置
  Scenario: [Happy Path] 通过环境变量配置端口
    Given 环境变量 PORT 设为 8080
    When 启动路由服务器
    Then 服务器监听在端口 8080

  # F3.1 — 环境变量配置
  Scenario: [Happy Path] 未设置 PORT 时使用默认端口
    Given 未设置 PORT 环境变量
    When 启动路由服务器
    Then 服务器监听在默认端口 3000

  # F3.1 — 环境变量配置
  Scenario: [Error Case] 未配置 API key 时服务器拒绝启动
    Given 未设置 CHORUS_API_KEYS 环境变量
    When 尝试启动路由服务器
    Then 服务器打印错误信息并退出

  # F4.1 — Dockerfile
  Scenario: [Happy Path] Docker 构建并运行
    Given 项目根目录有 Dockerfile
    When 执行 docker build 并 docker run
    Then 容器内路由服务器正常启动并可接受请求
