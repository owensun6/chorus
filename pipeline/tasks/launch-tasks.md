# Chorus 发布自检任务清单

> 创建时间: 2026-03-21T15:15:00Z
> 目的: 深度复盘发现的所有未闭环项，按优先级逐个解决
> 执行方式: Cron 每 20 分钟唤醒，每次完成一个任务

---

## 审计发现汇总

| # | 发现 | 严重度 | 状态 |
|---|------|--------|------|
| D1 | 推文 4/7 条超过 280 字符，无法直接发 Twitter | P0 | 待修 |
| D2 | zh-CN SKILL.md 模板未同步（还是旧版无自助注册） | P1 | 待修 |
| D3 | TRANSPORT.md 不在 npm 包里，Agent 通过 npx 安装拿不到 | P1 | 待修 |
| D4 | 探针没在跑，无持续性监控数据 | P1 | 待修 |
| D5 | 推广素材未按平台格式化（Bluesky 300 char、LinkedIn 长文等） | P2 | 待做 |
| D6 | Hub 最后一次 deploy 后未 redeploy SKILL.md 更新（代码侧无变化，纯文档） | P2 | 信息项 |
| D7 | awesome-list PR 模板未准备 | P2 | 待做 |
| D8 | GitHub Release / Discussion 未创建 | P2 | 待做 |

---

## 任务清单（执行顺序）

### T-01: 修复推文字数超限 [P0]
- 将 launch-announcement.md 中超过 280 字符的推文裁短
- 中文推文同步检查（中文 280 字容纳更多信息但仍需验证）
- 每条推文标注精确字符数
- **验收**: 所有推文 ≤ 280 字符

### T-02: 同步 zh-CN SKILL.md 模板 [P1]
- 将 skill/SKILL.md 的 "How to Connect" 章节翻译为中文
- 更新 packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md
- **验收**: diff 确认关键章节已同步

### T-03: 将 TRANSPORT.md 加入 npm 包 [P1]
- 在 packages/chorus-skill/package.json 的 files 数组中加入 TRANSPORT.md
- 复制 skill/TRANSPORT.md 到 packages/chorus-skill/templates/en/
- npm publish patch 版本
- **验收**: npx 安装后文件存在

### T-04: 重启探针监控 [P1]
- 启动 bin/alpha-probe-light.sh 后台运行
- 确认日志正常输出
- **验收**: /tmp/chorus-probe.log 有新数据

### T-05: 格式化各平台推广素材 [P2]
- Twitter/X: 每条 ≤ 280 char，线程格式
- Bluesky: 每条 ≤ 300 char
- LinkedIn: 长文版（~1000 字）
- GitHub Discussion: Markdown
- 输出到 docs/distribution/platform-ready/ 目录
- **验收**: 每个文件标注平台 + 字数

### T-06: 准备 awesome-list PR 模板 [P2]
- VoltAgent/awesome-agent-skills PR body
- e2b-dev/awesome-ai-agents PR body
- 输出到 docs/distribution/awesome-list-prs/
- **验收**: 格式符合各 list 的 contribution guidelines

### T-07: 创建 GitHub Release [P2]
- 基于 launch-announcement.md §5 创建 v0.6.0 Release
- Tag: v0.6.0-alpha
- **验收**: Release 页面可见

### T-08: 创建 GitHub Discussion [P2]
- 发布公告到 repo Discussions
- **验收**: Discussion URL 可访问

---

## 不胸有成竹的地方（诚实记录）

1. **Hub 持续性**: 只运行了 ~1 小时，没有 24h 数据。如果推广后有人来用然后 Hub 挂了——没有自动恢复机制
2. **Agent 自主安装体验**: SKILL.md 更新了，但没有真正让一个外部 Agent 从零走完全流程验证过。纸上谈兵
3. **npm 包同步**: TRANSPORT.md 不在 npm 包里意味着 Agent 通过 npx 安装后缺少传输层文档
4. **推文质量**: 4/7 条超限，说明写文案时没做字数校验，这是流程漏洞
5. **zh-CN 模板**: 中文用户占重要比例但中文模板落后一个大版本
