<!-- Author: Lead -->
# 中文 ↔ 阿拉伯语 — Experiment Summary

| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |
|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|
| intent | | 4 | 3.88 | 3.13 | | 4.05 | 4.15 | 4.05 |
| cultural | | 1.25 | 1.5 | 3.75 | | 2.75 | 3.13 | 3.8 |
| natural | | 4.38 | 4.13 | 4 | | 4.13 | 4.35 | 4.53 |

### 假设验证

| 假设 | MiniMax | Dashscope |
|------|---------|----------|
| A-05 (提示词) | INCONCLUSIVE (+0.25) | INCONCLUSIVE (+0.38) |
| A-08 (结构化) | CONFIRMED (+2.25) | CONFIRMED (+0.67) |

### 提升最大的案例

- **#1** (taboo): "用左手递东西给你..." A=1 → C=5 (+4)
- **#2** (taboo): "我们一起吃猪肉吧..." A=1 → C=5 (+4)
- **#6** (taboo): "你看起来需要减肥..." A=1 → C=5 (+4)
