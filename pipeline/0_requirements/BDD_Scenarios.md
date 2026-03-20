<!-- Author: PM -->

# ~~Chorus Protocol — Phase 0 BDD Scenarios~~ [SUPERSEDED]

> **⚠️ 本文档已被 `pipeline/BDD_Scenarios.md`（统一 BDD 验收场景）取代。保留为历史记录。**

# Chorus Protocol — Phase 0 BDD Scenarios

---

Feature: Chorus 语义信封格式规范

  # F1 — Chorus 语义信封
  Scenario: [Happy Path] Agent 发送包含完整信封的消息
    Given Agent A 代表中文用户 Alice，已与 Agent B 建立 Chorus 对话
    When Alice 输入"能不能帮我约个时间聊聊？"
    And Agent A 将其封装为 Chorus 语义信封
    Then 信封包含必填字段：协议版本 v0.1、原始语义意图（请求安排会面）、发送方文化背景（中国大陆）
    And 信封包含可选扩展字段：意图类型（请求）、情感基调（礼貌）、正式度（半正式）
    And 信封符合 A2A Message Extension 格式

  # F1 — Chorus 语义信封
  Scenario: [Happy Path] 可选字段为空时信封仍有效
    Given Agent A 在信封中仅填写必填字段，可选扩展字段全部为空
    When Agent B 收到此消息
    Then Agent B 直接从原始语义意图自行推断意图类型和情感基调
    And 对话正常继续，无降级

  # F1 — Chorus 语义信封
  Scenario: [Error Case] 信封缺少必填字段
    Given Agent A 生成了一条 Chorus 消息，但缺少原始语义意图字段
    When Agent B 收到此消息
    Then Agent B 返回格式错误提示，标明缺少哪个必填字段
    And 对话不中断，Agent A 可补充后重发

---

Feature: Agent Card 文化扩展规范

  # F2 — Agent Card 文化扩展
  Scenario: [Happy Path] Agent 读取对方 Card 确认语言能力
    Given Agent A 的 Agent Card 声明：文化背景=中国大陆，支持语言=[zh-CN, en]
    And Agent B 的 Agent Card 声明：文化背景=日本，支持语言=[ja, en]
    When Agent A 读取 Agent B 的 Agent Card
    Then Agent A 确认自身可处理日语
    And 用户看到提示"已与对方建立文化适配对话，对方语言: 日语，对方文化: 日本"

  # F2 — Agent Card 文化扩展
  Scenario: [Error Case] 对方 Agent 不支持 Chorus 扩展
    Given Agent C 是一个标准 A2A Agent，Agent Card 中无 Chorus 扩展字段
    When Agent A 尝试读取 Agent C 的文化扩展
    Then Agent A 通知用户"对方不支持文化适配对话，可降级为普通消息"

  # F2 — Agent Card 文化扩展
  Scenario: [Error Case] 双方语言能力不匹配
    Given Agent A 声明支持语言为 [zh-CN]
    And Agent D 声明支持语言为 [sw]（斯瓦希里语），底层 LLM 不支持中文
    When 双方尝试建立 Chorus 对话
    Then 用户看到提示"语言能力不匹配，无法建立文化适配对话"

---

Feature: 最小文化适配提示词模板

  # F3 — 提示词模板
  Scenario: [Happy Path] Agent 使用提示词进行文化适配
    Given Agent B 加载了 Chorus 协议规定的最小提示词模板
    And Agent B 收到来自中国用户 Agent 的消息，原始语义为"拒绝对方提议"
    When Agent B 为日本用户适配此消息
    Then 输出使用日本文化中常见的间接拒绝表达方式（而非逐字翻译"我拒绝"）
    And 原始的拒绝意图被完整保留，用户能理解对方在拒绝

  # F3 — 提示词模板
  Scenario: [Error Case] Agent 文化适配产生刻板印象
    Given Agent B 收到来自中国用户 Agent 的正常商务提议
    When Agent B 过度适配，输出包含对中国文化的刻板印象表达
    Then 接收方用户可查看信封中的原始语义意图，与适配结果做对比
    And 信封中的原始语义始终不可被适配过程覆盖

---

Feature: 三组对比验证实验

  # F4 — 三组对比实验
  Scenario: [Happy Path] 文化禁忌场景三组对比
    Given 测试语料"你看起来胖了不少啊"（中国文化中可作为关心，日本文化中属冒犯）
    When 分三组处理：A组机械翻译、B组极简信封+提示词、C组完整信封+提示词
    Then 三组输出由 LLM-as-judge 按三维度打分（意图保留 1-5、文化适当性 1-5、自然度 1-5）
    And B 组在文化适当性维度得分高于 A 组（验证 A-05）

  # F4 — 三组对比实验
  Scenario: [Happy Path] 俚语场景三组对比
    Given 测试语料含日文俚语"空気を読む"（读懂气氛）
    When 分三组处理传递给代表中国用户的 Agent
    Then B 组输出用中文等价表达（如"要有眼力见"）
    And A 组输出字面翻译"读空气"
    And C 组 vs B 组的差异数据记录，用于判断结构化字段是否增值（验证 A-08）

  # F4 — 三组对比实验
  Scenario: [Happy Path] 200 条语料批量运行
    Given 200 条预制测试语料（100 条文化禁忌 + 100 条俚语）
    When 全部语料跑完三组对比
    Then 输出汇总报告：每组的三维度平均分、标准差
    And 报告明确结论：B>>A 则 A-05 成立，C>>B 则 A-08 成立，C≈B 则信封极简化

  # F4 — 三组对比实验
  Scenario: [Error Case] LLM API 调用失败
    Given 参考 Agent 的 LLM API Key 已过期
    When 用户启动验证实验
    Then 系统返回"LLM 服务不可用，请检查 API Key"
    And 不产生损坏的信封或无效评分

  # F4 — 三组对比实验
  Scenario: [Error Case] 某条语料三组输出无差异
    Given 某条测试语料内容极简单（如"好的"）
    When 三组处理后输出高度相似
    Then 该条正常计入统计，不伪造差异
    And 汇总报告中如实反映
