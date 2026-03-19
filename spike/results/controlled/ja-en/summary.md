<!-- Author: Lead -->
# 日语 ↔ 英语 — Experiment Summary

| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |
|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|
| intent | | 3.45 | 3.67 | 3.65 | | 4.05 | 4.3 | 4.2 |
| cultural | | 3.23 | 3.77 | 3.55 | | 2.6 | 3.25 | 4.2 |
| natural | | 4.13 | 4.38 | 4.15 | | 4.15 | 4.53 | 4.72 |

### 假设验证

| 假设 | MiniMax | Dashscope |
|------|---------|----------|
| A-05 (提示词) | CONFIRMED (+0.54) | CONFIRMED (+0.65) |
| A-08 (结构化) | INCONCLUSIVE (-0.22) | CONFIRMED (+0.95) |

### 提升最大的案例

- **#2** (taboo): "お子さんはまだですか？..." A=1 → C=5 (+4)
- **#7** (taboo): "お酒が飲めないなんて、大丈夫ですか？..." A=1 → C=5 (+4)
- **#10** (taboo): "女のくせに車を運転するんですか？..." A=1 → C=5 (+4)
