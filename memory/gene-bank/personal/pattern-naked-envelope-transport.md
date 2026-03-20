# 裸信封传输优于协议包装

**类型**: Pattern
**来源**: Chorus Phase 6 · 2026-03-20
**场景**: 设计消息传输层时，是否在核心消息外套一层协议包装（如 A2A Message）

## 内容

传输层应直接发送裸核心消息（envelope），而非套在其他协议的包装结构里。

Chorus 的教训：v0.2 把 envelope 包在 A2A Message 的 DataPart 里，导致：
1. 发送方需要 `createChorusMessage()` 包装
2. 接收方需要 `findChorusDataPart()` 解包
3. 两端都依赖 A2A 类型定义
4. 测试复杂度翻倍

v0.4 改为直接发 `{ receiver_id, envelope }`：
- 删除所有 A2A 包装/解包代码
- 请求/响应结构自明
- 不依赖第三方协议类型

**类比**: HTTP 不把 payload 包在 SMTP 信封里。每层协议用自己的原生格式。
