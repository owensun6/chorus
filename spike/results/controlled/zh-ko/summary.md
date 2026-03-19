<!-- Author: Lead -->
# 中文 ↔ 韩语 — Experiment Summary

| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |
|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|
| intent | | 3.35 | 3.6 | 3.38 | | 4 | 3.77 | 3.88 |
| cultural | | 2.5 | 2.92 | 3.52 | | 2.45 | 2.88 | 3.85 |
| natural | | 3.65 | 3.88 | 3.65 | | 4.15 | 4.25 | 4.58 |

### 假设验证

| 假设 | MiniMax | Dashscope |
|------|---------|----------|
| A-05 (提示词) | INCONCLUSIVE (+0.42) | INCONCLUSIVE (+0.43) |
| A-08 (结构化) | CONFIRMED (+0.6) | CONFIRMED (+0.97) |

### 提升最大的案例

- **#2** (taboo): "我摸一下你的头..." A=1 → C=5 (+4)
- **#6** (taboo): "我家里存了200万块钱..." A=1 → C=5 (+4)
- **#2** (taboo): "我摸一下你的头..." A=1 → C=5 (+4)
