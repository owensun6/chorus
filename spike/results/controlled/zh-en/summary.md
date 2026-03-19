<!-- Author: Lead -->
# 中文 ↔ 英语 — Experiment Summary

| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |
|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|
| intent | | 3.8 | 4.1 | 3.83 | | 4.65 | 4.63 | 4.4 |
| cultural | | 3.13 | 3.48 | 4.28 | | 3.1 | 3.95 | 4.38 |
| natural | | 3.88 | 4.28 | 4.47 | | 4.58 | 4.8 | 4.8 |

### 假设验证

| 假设 | MiniMax | Dashscope |
|------|---------|----------|
| A-05 (提示词) | INCONCLUSIVE (+0.35) | CONFIRMED (+0.85) |
| A-08 (结构化) | CONFIRMED (+0.8) | CONFIRMED (+0.43) |

### 提升最大的案例

- **#1** (taboo): "你多大了？什么时候结婚？..." A=1 → C=5 (+4)
- **#2** (taboo): "你怎么这么胖？应该多运动。..." A=1 → C=5 (+4)
- **#4** (taboo): "你气色不好，脸色很苍白，是不是生病了？..." A=1 → C=5 (+4)
