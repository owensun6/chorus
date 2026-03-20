<!-- Author: PM -->
<!-- ⚠️ SUPERSEDED: 本文档已被 pipeline/PRD.md（统一 PRD v2.0）取代。保留为历史记录。 -->

project: Chorus Protocol — Phase 4: 路由服务器公网部署
compiled_from: "将 Chorus 路由服务器部署到公网，让任何 Agent 可以通过互联网注册和通信。Chorus 是协议平台（类似 SMTP），路由服务器是邮局，只负责信封转发，不拆信不翻译。"
status: PENDING_GATE_0

---

## 1. 业务背景

Chorus 路由服务器目前只能在 localhost 运行。要让不同机器上的 Agent 通过互联网通信，需要将路由服务器部署到公网。路由服务器是纯 HTTP 中继（零 LLM 调用），部署复杂度等同于一个轻量 API 网关。

## 2. 用例清单 (Use Cases)

- UC-01: Agent 通过 HTTPS 向公网路由服务器注册，需携带 API key 验证身份
- UC-02: 已注册 Agent 通过路由服务器发现其他兼容 Agent 并发送消息
- UC-03: 运维通过健康检查端点监控服务状态
- UC-04: 通过 Docker 镜像一键部署到任意云平台

## 3. 非功能性需求

- HTTPS: 公网通信强制加密（反向代理或平台提供）
- 零 LLM 依赖: 路由服务器不调用任何 LLM，不需要 API key
- 内存存储: 重启清空，与 Phase 1 设计一致
- 无 Web UI: demo 页面不上公网

## 3.5 Phase 4 不做清单

| 不做 | 原因 |
|------|------|
| 速率限制 | 第一版不做，Agent 自带成本控制 |
| 持久化存储 | 内存即可，注册信息不落盘 |
| Web UI 公网部署 | demo 页面仅限本地 |
| LLM 相关配置 | 路由服务器不调用 LLM |
| 多实例/集群 | 第一版单实例足够 |

## 4. 假设登记表（Commander 需确认）

| ID | 假设描述 | 维度 | 依据来源 | 影响(H/M/L) | 风险(H/M/L) | Commander 确认 |
|----|---------|------|---------|------------|------------|---------------|
| A-01 | HTTPS 由反向代理或部署平台（Railway/Fly.io 等）提供，路由服务器本身仍监听 HTTP | Feasibility | 行业惯例（主流云平台自动提供 TLS 终止） | M | L | |
| A-02 | API key 鉴权采用 Bearer token 方式，路由服务器启动时通过环境变量加载一组预设 key | Usability | MVP 原则 + 行业惯例 | M | L | |
| A-03 | 鉴权仅保护写操作（注册/发消息），Agent 列表查询（GET /agents）无需鉴权 | Usability | 协议开放性 — 类似 SMTP MX 记录公开可查 | M | M | |
| A-04 | Docker 镜像基于 node:22-alpine，单阶段构建足够（项目无原生依赖） | Feasibility | 项目 devDependencies 无 native addon | L | L | |
| A-05 | Agent 自行保证其注册的 endpoint 可从公网访问（类似 SMTP 的 MX 记录指向公网 IP），路由服务器不负责 NAT 穿透 | Feasibility | 协议设计 — 邮局不管你家有没有邮箱 | H | L | |
