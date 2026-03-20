<!-- Author: Lead -->

# Phase 5 依赖图（v2）

```
[T-01 PROTOCOL.md en] ──┬──> [T-02 PROTOCOL.md zh-CN]
                        ├──> [T-03 SKILL.md en] ──┬──> [T-04 SKILL.md zh-CN]
                        │                         └──> [T-07 跨平台验证]
                        └──> [T-05 同文化示例]
                                                       ↓
[T-08 README + L3] (独立)          [T-02,T-04,T-05] ──> [T-06 npm CLI 包]
```

并行度：T-01 + T-08 同时启动。
T-01 完成后解锁 T-02, T-03, T-05（三任务并行）。
T-03 完成后解锁 T-04, T-07（两任务并行）。
T-06 最后——等所有内容就绪才打包。
