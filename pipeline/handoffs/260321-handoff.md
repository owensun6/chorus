# Handoff — 2026-03-21

## ⚡ 立即行动（第一步）

无紧急行动。分发闭环已完成，项目进入"等外部信号"状态。如有外部反馈到达，读取 `docs/distribution/outreach-targets.md` 确认信号类型，按 quick-trial 引导对方。

---

## 当前状态

- **项目**: Chorus Protocol — Agent-to-Agent Communication Standard
- **阶段**: 分发准备完成，等待外部采纳信号
- **GitHub**: `owensun6/chorus`（private）
- **npm**: `@chorus-protocol/skill@0.4.1`（published, public）
- **npm 账号**: `sunyimin111`，org `@chorus-protocol`
- **协议版本**: 0.4
- **测试**: 13 suites / 142 tests 全绿

---

## 本会话完成事项

### npm 发布
- `@chorus-protocol/skill@0.4.0` 首发 → commit `60fa789`
- `@chorus-protocol/skill@0.4.1`（加 `--target` flag）→ commit `497a3f8`
- npm org `@chorus-protocol` 创建，Granular Access Token（bypass 2FA）配置
- GitHub repo `owensun6/chorus` 创建并推送

### 包加固
- 模板同步修复：en + zh-CN PROTOCOL.md 均与源一致（RFC-001 cultural_context MAY 降级）
- package.json：加 `files`/`engines`/`repository`/`homepage`/`bugs`
- cli.mjs：版本号动态读取，新增 `--target` 和 `uninstall` 命令
- README.md + LICENSE（Apache 2.0）加入包和仓库根

### CLI 增强（0.4.1）
- `init --target openclaw`：安装到 `~/.openclaw/skills/chorus/` + 自动注册 `openclaw.json`
- `init --target claude-user`：安装到 `~/.claude/skills/chorus/`
- `init --target claude-project`：安装到 `.claude/skills/chorus/`
- `uninstall --target`：删除文件 + 反注册（OpenClaw）

### 分发文档（`docs/distribution/`）
- `openclaw-install.md` — 5 条安装路径，OpenClaw 为主路径 → commit `2c8131f`
- `npm-release-checklist.md` — 发布前 gate（Commander 重写版）
- `quick-trial.md` — 外部 5-10 分钟试用脚本
- `outreach-targets.md` — 4 类第一波触达对象 + 信号定义
- `release-0.4.0.md` + `release-0.4.1.md` — 发布记录

### 入口统一
- 所有对外文档（README、quick-trial、install guide、outreach）统一到 `npx @chorus-protocol/skill init --target openclaw` → commit `2c8131f`

### 本地验证
- OpenClaw 安装+注册+卸载全链路测试通过
- Claude Code user/project 安装测试通过
- npm registry smoke test（从 registry 下载执行）通过

---

## 待完成（按优先级）

1. [P1] 等外部信号 — 依赖：外部开发者真实安装和反馈
2. [P2] `docs/distribution/clawhub-prep.md` — ClawHub 上架元数据准备（Commander 原始计划 Phase 2 第 5 项，未启动）
3. [P2] 仓库公开 — 依赖：Commander 决定时机
4. [P3] `npm pkg fix` 修复 bin 字段 warn — npm publish 时有 `bin[chorus-skill] script name cli.mjs was invalid and removed` 警告，不影响功能但应清理

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| OpenClaw 是主入口 | 所有对外文档以 `--target openclaw` 为第一推荐 | OpenClaw 是主要触达渠道 |
| 不猜测 npm metadata | `repository`/`homepage`/`bugs` 只填已验证的 URL | 防止用户被导向错误页面 |
| npm token 不经对话传递 | Commander 本地 `npm config set` | 安全考虑 |
| 分发闭环 = 不再补内部材料 | 不写更多内部文档，等外部信号 | 避免过度准备，信号驱动 |

---

## 必读文件

1. `docs/distribution/quick-trial.md` — 外部试用脚本，最可能被外部人首先接触
2. `docs/distribution/openclaw-install.md` — 完整安装路径，处理外部安装问题时参考
3. `docs/distribution/outreach-targets.md` — 触达对象和信号定义
4. `packages/chorus-skill/cli.mjs` — CLI 实现，处理 bug 报告时参考
5. `docs/distribution/npm-release-checklist.md` — 下次发布时使用

---

## 风险与禁区

- **禁止**: 修改已发布的 release note（`release-0.4.0.md`）— 历史记录不可篡改，新版变更写新文件
- **禁止**: 在没有 `git remote -v` 确认的情况下填写 package.json 的 URL 字段
- **注意**: `npm publish` 的 `bin` 字段 warn 不影响 `npx` 执行，但说明 `cli.mjs` 的 bin 命名可能需要调整（npm 期望不带扩展名的 bin 名）
- **注意**: npm token 配置在 `~/.npmrc`，Granular Access Token 有效期到 2026-06-19
