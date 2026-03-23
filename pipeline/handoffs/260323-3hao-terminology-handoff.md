# Handoff — 2026-03-23 3号 术语统一

## ⚡ 立即行动（第一步）

验证术语两轨规则落地：`grep -rn "人类" skill/SKILL.zh-CN.md packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md` 应为 0 匹配。

---

## 当前状态

- **项目**: Chorus v0.8.0-alpha 发布准备
- **3号 角色**: 独立审查者 + 中文文档所有者
- **本次任务**: 术语统一 — "人类" → "用户"（中文文件，按两轨规则执行）
- **阻塞点**: 无。本次任务已闭环。

---

## 本会话完成事项

### 第 1 轨：终端用户场景（人类 → 用户）

| 文件 | 替换数 | 验证 |
|------|--------|------|
| `skill/SKILL.zh-CN.md` | 31 | ✅ grep 零匹配 |
| `packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md` | 28 | ✅ grep 零匹配 |
| `README.md` 中文段 (L173, L219, L243) | 3 | ✅ |
| `docs/distribution/v0.8.0-alpha-launch-kit.md` L206 FAQ | 1 | ✅ |

### 第 2 轨：可感知性/可读性（保留 human 语义，不改成"用户"）

| 文件 | 改动 |
|------|------|
| `docs/distribution/v0.8.0-alpha-launch-kit.md` L45,51,222 | "人类可见" → "人可见" |
| `docs/launch-announcement.md` L134 | "人类可见" → "人可见" |
| `skill/PROTOCOL.zh-CN.md` L46 | "人类可读" → "便于阅读的" |
| `packages/chorus-skill/templates/zh-CN/PROTOCOL.zh-CN.md` L46 | 同上 |

### 已修正的误判

1. PROTOCOL "人类可读" 初次误改为"用户可读" → 回退为"便于阅读的"（技术术语，不收窄语义）
2. launch-kit/announcement "人类可见" 初次误改为"用户可见" → 回退为"人可见"（visibility ≠ role）

---

## 待完成（按优先级）

1. [P1] ClawHub 面仍为占位模板 — `skills/clawhub-minimal-template/SKILL.md` 没有真实 Chorus skill。需 Commander 决策结构（symlink / copy / redirect）。在此之前"三面统一"不可宣称。
2. [P1] Git tag `v0.8.0-alpha` 未创建 — Commander 最终审核后创建
3. [P2] 内部文档中的"人类"保持原样 — `memory-bank/progress.md`、`pipeline/`、`docs/chorus-bridge-*.md` 等历史/内部文件不在本次范围，未来可按需逐文件处理

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 两轨判定规则 | 能替换成"这个 agent 的服务对象"且语义不变 → 用"用户"；否则保留 human 语义 | Commander 2026-03-23 指令 |
| 英文 human-visible 冻结 | human-visible / human-facing / human-readable / human corrections → 技术/发布术语，不做机械替换 | Commander 明确保留 |
| 中文第 2 轨译法 | "人可见" / "便于阅读的" / "面向人的" — 不绑定"用户" | 避免收窄语义 |
| SKILL 文件全部为第 1 轨 | SKILL 中的"人类"31 处无一例外都是"agent 服务的那个人" | 逐句审计确认 |

---

## 必读文件

1. `skill/SKILL.zh-CN.md` — 替换后的中文协议技能文档，验证"用户"术语是否通顺
2. `docs/distribution/v0.8.0-alpha-launch-kit.md` — 中文发布素材，确认"人可见"措辞
3. `docs/distribution/release-claims-boundary.md` — 发布口径边界（能说什么/不能说什么）

---

## 风险与禁区

- **禁止**: 机械地全局替换 "human" → "user" — 原因：已验证会破坏 human-visible/human-readable 等技术术语
- **禁止**: 改动英文 "human-visible" 为 "user-visible" — 原因：Commander 明确冻结
- **注意**: npm template (`packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md`) 必须与 source (`skill/SKILL.zh-CN.md`) 保持同步 — 两个文件内容应一致（"怎么连接"段落除外，template 有 bridge 委托说明）
