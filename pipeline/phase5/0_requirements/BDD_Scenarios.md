<!-- Author: PM -->

# Chorus — BDD 验收场景

> Phase 5+ 验收标准

---

## F5.1: Chorus SKILL.md

### Scenario: Agent 首次加载 Skill 后能发送 Envelope

```gherkin
Given 一个从未接触过 Chorus 协议的 AI Agent
And 该 Agent 具备基础 LLM 调用能力
When Agent 读取 Chorus SKILL.md 文件
And Agent 收到用户输入 "辛苦了，这个项目多亏了你"
Then Agent 输出一个合法的 Chorus Envelope JSON
And Envelope 包含 chorus_version = "0.3"
And Envelope 包含非空的 original_semantic
And Envelope 包含 sender_culture 为合法 BCP47 标签
And Envelope 包含 10-500 字的 cultural_context
```

### Scenario: Agent 加载 Skill 后能接收并适配 Envelope

```gherkin
Given 一个已加载 Chorus SKILL.md 的 Agent（receiver_culture = ja）
When Agent 收到一个 Chorus Envelope:
  | 字段 | 值 |
  | chorus_version | "0.3" |
  | original_semantic | "表达感谢和辛劳的认可" |
  | sender_culture | "zh-CN" |
  | cultural_context | "中国职场中'辛苦了'是对同事付出的认可..." |
Then Agent 输出日文适配文本
And 适配文本符合日本文化表达习惯
And 适配文本保留了原文的感谢意图
```

### Scenario: Skill 传输无关且模型无关

```gherkin
Given Chorus SKILL.md 文件内容
When 搜索全文
Then 不包含任何传输/连接方式的关键词
And 不包含具体 LLM 模型名称
And 不包含 personality 配置
```

---

## F5.2: envelope.schema.json

### Scenario: Schema 验证合法 Envelope

```gherkin
Given envelope.schema.json 文件
When 验证包含所有必填字段的 JSON
Then 验证通过
```

### Scenario: Schema 拒绝缺少必填字段

```gherkin
Given envelope.schema.json 文件
When 验证缺少 original_semantic 的 JSON
Then 验证失败
```

### Scenario: Schema 允许扩展字段

```gherkin
Given envelope.schema.json 文件
When 验证包含未定义字段的 Envelope
Then 验证通过（additionalProperties: true）
```

---

## F5.3: Skill 示例集

### Scenario: 示例覆盖已验证语言对

```gherkin
Given examples/ 目录
Then 至少包含 zh-CN ⟷ ja 双向信封示例
And 每个示例包含完整 Envelope JSON（含 cultural_context）
And 每个示例包含接收端适配输出文本
```

### Scenario: 示例符合 Schema

```gherkin
Given 任意示例中的 Envelope JSON
When 用 envelope.schema.json 验证
Then 验证通过
```

---

## F5.4: 跨平台 Skill 验证

### Scenario: 非本项目 Agent 加载 Skill 后能发送合法 Envelope

```gherkin
Given 一个非 Chorus 项目的 AI Agent
And 该 Agent 从未见过 Chorus 相关代码
When 该 Agent 加载 Chorus SKILL.md 并收到用户输入
Then 输出合法的 Chorus Envelope
And Envelope 通过 envelope.schema.json 验证
```

### Scenario: 跨平台 Agent 的文化适配质量达到基线

```gherkin
Given 一个非 Chorus 项目的 Agent 已加载 SKILL.md（receiver_culture = ja）
When 收到 sender_culture = zh-CN 的 Chorus Envelope（含 cultural_context）
Then 适配文本为日文
And 文化适配质量评分 ≥ 3.0/5（LLM-as-judge，与 Phase 0 baseline 可比）
```

---

## F5.5: 参考实现重定位

### Scenario: 现有代码标注为 L3 可选

```gherkin
Given 项目文档
When 检查对现有代码（src/server/, src/agent/）的描述
Then 标注为"参考实现"或"L3 Ecosystem"
And 说明不是使用 Chorus 协议的前提条件
```

### Scenario: 无参考实现时 Skill 独立工作

```gherkin
Given 一个 Agent 仅加载了 Chorus SKILL.md
And 没有运行任何参考实现代码
When Agent 收到用户输入
Then 能独立生成合法 Chorus Envelope
```

---

## F5.6: npm 包

### Scenario: 编程式构建 Envelope

```gherkin
Given 已安装 @chorus-protocol/core
When 调用 envelope.create(...)
Then 返回合法 ChorusEnvelope 对象
```

### Scenario: 编程式验证 Envelope

```gherkin
Given 已安装 @chorus-protocol/core
When 调用 envelope.validate(invalidJson)
Then 抛出验证错误并指出具体字段
```

---

## F5.7: 扩展语言对

### Scenario: 高文化距离语言对

```gherkin
Given 已加载 Chorus Skill 的 Agent（receiver_culture = ar）
When 收到 sender_culture = zh-CN 的 Envelope
Then 适配质量 ≥ 3.5/5（LLM-as-judge）
```

### Scenario: 低文化距离语言对

```gherkin
Given 已加载 Chorus Skill 的 Agent（receiver_culture = ko）
When 收到 sender_culture = zh-CN 的 Envelope
Then 适配质量 ≥ 3.0/5（LLM-as-judge）
```

---

## F5.8: Agent 社交网络概念验证

### Scenario: Agent 自主发现兴趣伙伴

```gherkin
Given Agent 社交平台上有多个来自不同文化的 Agent
When 一个 Agent 在"美食"兴趣组发现另一个文化背景不同的 Agent
Then Agent 能向自己的人类推荐"要不要跟 ta 聊聊？"
And 人类同意后，两个 Agent 通过 Chorus 协议建立跨文化对话
```
