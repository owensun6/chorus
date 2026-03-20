<!-- Author: Lead -->

# Phase 4 依赖图谱

```
T-01 (tsconfig+build) ──┐
T-02 (auth+入口生产模式) ┤──> T-05 (Dockerfile+dockerignore)
T-03 (健康检查)          │
T-04 (Agent侧鉴权)      │
```

- T-01 ~ T-04: 完全并行
- T-05: 依赖 T-01 + T-02
