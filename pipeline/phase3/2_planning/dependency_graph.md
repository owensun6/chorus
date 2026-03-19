<!-- Author: Lead -->

# Phase 3 依赖图谱

```
T-01 (Schema)  ──┬──> T-03 (Router 转发) ──> T-05 (LLM prompt)
                 ├──> T-04 (Receiver 读取) ─┘
                 └──> T-06 (Agent 注册) ──> T-07 (Demo 人格)
T-02 (Config)  ──┘
```

- T-01 + T-02: 完全并行，无依赖
- T-03 + T-04: 依赖 T-01（需要 personality 类型定义），可并行
- T-05: 依赖 T-04（需要 receiver 传入 personality 参数）
- T-06: 依赖 T-01 + T-02
- T-07: 依赖 T-06
