<!-- Author: Lead -->
# 中文 ↔ 日语 — Experiment Summary

| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |
|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|
| intent | | 3.05 | 3.05 | 3.3 | | 3.83 | 3.95 | 3.73 |
| cultural | | 2.48 | 2.48 | 3.67 | | 2.4 | 3.13 | 3.95 |
| natural | | 3.15 | 3.38 | 3.92 | | 3.88 | 4.2 | 4.4 |

### 假设验证

| 假设 | MiniMax | Dashscope |
|------|---------|----------|
| A-05 (提示词) | INCONCLUSIVE (0) | CONFIRMED (+0.73) |
| A-08 (结构化) | CONFIRMED (+1.19) | CONFIRMED (+0.82) |

### 提升最大的案例

- **#2** (taboo): "你真胖啊..." A=1 → C=5 (+4)
- **#3** (taboo): "你老了..." A=1 → C=5 (+4)
- **#8** (taboo): "你为什么还没结婚？..." A=1 → C=5 (+4)
