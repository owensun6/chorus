# Chorus 推广自动化工具调研

> 调研日期: 2026-03-21
> 用途: 供多个 OpenClaw Agent 并行执行推广任务时参考
> 原则: 只收录能**实际执行动作**（发帖/提交/DM）的工具，纯草稿/只读工具不在此列

---

## 一、工具总表

| 平台 | 工具 | GitHub Stars | 能力 | 类型 | 认证方式 | 安装复杂度 |
|------|------|-------------|------|------|---------|-----------|
| Twitter/X | EnesCinr/twitter-mcp | 377 | 发推 + 搜索 | MCP Server | Twitter API Keys | 低 |
| Twitter/X | taazkareem/twitter-mcp-server | 19 | 发推 + 线程 + 媒体 + 回复 + 点赞 + 转推 | MCP Server | Twitter 用户名密码 或 API Keys | 中 |
| Twitter/X | rafaljanicki/x-twitter-mcp-server | 29 | 发推 + 删推 + 收藏 + 搜索 + 时间线 | MCP Server (Python) | Twitter API v2 全套凭证 | 中 |
| 多平台 | synapz-org/typefully-claude-skill | 3 | X + LinkedIn + Threads + Bluesky + Mastodon 发帖/排程 | Claude Skill | Typefully API Key | 中 |
| 多平台 | pepuscz/typefully-mcp-server | 6 | 同上，MCP 版本 | MCP Server (Python) | Typefully API Key | 中 |
| Bluesky | morinokami/mcp-server-bluesky | 10 | 发帖 + 删帖 + 转发 + 点赞 + 关注 + 搜索 | MCP Server | Bluesky 用户名 + App Password | 低 |
| GitHub | github/github-mcp-server | 28,116 | Issues + PRs + Discussions + Releases + Comments | MCP Server | GitHub PAT | 低 |
| Dev.to | extinctsion/mcp-devto | 1 | 创建文章 + 搜索 | MCP Server (.NET) | Dev.to API Key | 中 |
| Discord | genm/mcp-server-discord-webhook | 0 | 发消息到频道 | MCP Server | Discord Webhook URL | 低 |
| Slack | korotovsky/slack-mcp-server | 1,466 | 发消息 + DM | MCP Server | Slack Session Token | 中 |
| LinkedIn | sigvardt/linkedin-buddy | 0 | 发帖 + 搜索 + DM（浏览器自动化） | MCP Server | LinkedIn Cookie | 高（封号风险） |

### 无法自动发帖的平台

| 平台 | 原因 | 替代方案 |
|------|------|---------|
| Reddit | 无写入 MCP Server；API 限制自动化发帖 | 手动发帖，或用 PRAW 自建 |
| Hacker News | 无 API，所有 MCP 只读 | 只能手动提交 |
| Product Hunt | 无 MCP Server | 只能手动提交 |

---

## 二、各工具详细说明

### 2.1 Twitter/X — EnesCinr/twitter-mcp（推荐：最快上手）

**GitHub**: https://github.com/EnesCinr/twitter-mcp

**能力**:
- `post_tweet`: 发推文
- `search_tweets`: 搜索推文

**认证**: Twitter Developer Portal 申请 API Keys
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET_KEY`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

**安装**:
```bash
npx -y @enescinar/twitter-mcp
```

**Claude Desktop 配置**:
```json
{
  "mcpServers": {
    "twitter": {
      "command": "npx",
      "args": ["-y", "@enescinar/twitter-mcp"],
      "env": {
        "TWITTER_API_KEY": "...",
        "TWITTER_API_SECRET_KEY": "...",
        "TWITTER_ACCESS_TOKEN": "...",
        "TWITTER_ACCESS_TOKEN_SECRET": "..."
      }
    }
  }
}
```

**局限**: 不支持线程、媒体上传、排程。适合单条推文。

---

### 2.2 Twitter/X — taazkareem/twitter-mcp-server（推荐：功能最全）

**GitHub**: https://github.com/taazkareem/twitter-mcp-server

**能力**:
- 发推、回复、点赞、转推、引用
- **发布线程**（多条推文串联）
- **上传媒体**（图片/视频）
- 关注/取关
- 读取时间线、搜索

**认证方式二选一**:
1. Twitter 用户名 + 密码 + 邮箱（cookie 模式，通过 `agent-twitter-client`）
2. Twitter API Keys（官方 API 模式）

**安装**:
```bash
git clone https://github.com/taazkareem/twitter-mcp-server.git
cd twitter-mcp-server && npm install && npm run build
```

**适用场景**: 需要发线程（如我们的 7 条推文线程）、上传图片、互动型推广。

---

### 2.3 Twitter/X — rafaljanicki/x-twitter-mcp-server

**GitHub**: https://github.com/rafaljanicki/x-twitter-mcp-server

**能力**: 发推、删推、收藏、搜索、用户资料、关注者管理、书签、时间线

**认证**: Twitter API v2 全套（API Key, API Secret, Access Token, Access Token Secret, Bearer Token）

**安装**:
```bash
pip install x-twitter-mcp
# 或 Docker
```

**特点**: Python 生态，内置速率限制处理，支持 Smithery 一键安装。

---

### 2.4 多平台 — Typefully（一个工具覆盖 5 个平台）

**Skill 版**: https://github.com/synapz-org/typefully-claude-skill
**MCP 版**: https://github.com/pepuscz/typefully-mcp-server

**能力**:
- 在 X、LinkedIn、Threads、Bluesky、Mastodon 上创建草稿 / 排程发布
- 多账号交叉发布
- 线程格式化
- 数据分析

**认证**: Typefully API Key（Settings > Integrations）

**注意**:
- Typefully 是付费产品（$12.50+/月解锁排程功能）
- 免费版可以创建草稿但需要手动点发布
- 是唯一能合法发 LinkedIn 帖子的方式（LinkedIn 无个人发帖 API）

**MCP 版安装**:
```bash
pip install typefully-mcp-server  # 或 git clone
```

**配置**:
```json
{
  "mcpServers": {
    "typefully": {
      "command": "python",
      "args": ["-m", "typefully_mcp"],
      "env": {
        "TYPEFULLY_API_KEY": "..."
      }
    }
  }
}
```

---

### 2.5 Bluesky — morinokami/mcp-server-bluesky（推荐：零成本）

**GitHub**: https://github.com/morinokami/mcp-server-bluesky

**能力**:
- `bluesky_post`: 发帖
- `bluesky_delete_post`: 删帖
- `bluesky_repost`: 转发
- `bluesky_like`: 点赞
- `bluesky_follow`: 关注
- 读取时间线、搜索、查看个人资料

**认证**: Bluesky 用户名 + App Password（在 Bluesky Settings 中免费生成）

**安装**:
```bash
npx -y mcp-server-bluesky
```

**配置**:
```json
{
  "mcpServers": {
    "bluesky": {
      "command": "npx",
      "args": ["-y", "mcp-server-bluesky"],
      "env": {
        "BLUESKY_USERNAME": "your.handle",
        "BLUESKY_PASSWORD": "your-app-password"
      }
    }
  }
}
```

**为什么推荐**: Bluesky 基于 AT Protocol（开放协议），开发者友好，零成本，无审批。与 Chorus 的开放协议理念契合。

---

### 2.6 GitHub — github/github-mcp-server（官方）

**GitHub**: https://github.com/github/github-mcp-server

**能力**: 完整 GitHub API — Issues、PRs、Discussions、Releases、Comments、Repos、Workflows

**推广用途**:
- 给 awesome-lists 提 PR（如 `sindresorhus/awesome`、`VoltAgent/awesome-agent-skills`）
- 在相关项目的 Discussions 发帖
- 在 agent-to-agent / multi-agent 相关 issue 下评论
- 创建 GitHub Release 公告

**认证**: GitHub Personal Access Token

**安装**: 零安装，远程服务器可用
```
https://api.githubcopilot.com/mcp/
```

**或者直接用 `gh` CLI**（已安装）:
```bash
# 给 awesome-agent-skills 提 PR
gh pr create --repo VoltAgent/awesome-agent-skills --title "Add Chorus Protocol" --body "..."

# 在自己的 repo 发 Discussion
gh api repos/owensun6/chorus/discussions -X POST -f title="..." -f body="..."
```

---

### 2.7 Dev.to — extinctsion/mcp-devto

**GitHub**: https://github.com/extinctsion/mcp-devto

**能力**: 创建技术文章、搜索文章

**认证**: Dev.to API Key（免费，从 https://dev.to/settings/extensions 获取）

**安装**: 需要 .NET 9.0 SDK 或 Docker

**适用场景**: 发布 Chorus 的技术博客文章到 Dev.to。

---

### 2.8 Discord — genm/mcp-server-discord-webhook

**GitHub**: https://github.com/genm/mcp-server-discord-webhook

**能力**: 通过 Webhook 向 Discord 频道发消息

**认证**: Discord Webhook URL（在频道设置中创建）

**适用场景**: 在 AI agent / multi-agent 相关 Discord 社区发布公告。

---

### 2.9 Slack — korotovsky/slack-mcp-server

**GitHub**: https://github.com/korotovsky/slack-mcp-server

**能力**: 发消息、DM、查看频道

**认证**: Slack Session Token

**适用场景**: 在 AI/Agent 相关 Slack 工作区发布。

---

### 2.10 LinkedIn — sigvardt/linkedin-buddy（高风险）

**GitHub**: https://github.com/sigvardt/linkedin-buddy

**能力**: 100+ MCP 工具，发帖、搜索、DM、关注

**认证**: LinkedIn Session Cookie（Playwright 浏览器登录）

**重要警告**:
- 使用浏览器自动化模拟用户操作，违反 LinkedIn ToS
- **存在封号风险**
- 该工具有反检测机制（拟人输入、Poisson 延迟、贝塞尔鼠标轨迹）但不保证安全
- **建议通过 Typefully 发 LinkedIn**，这是唯一合规路径

---

## 三、推荐部署方案

### 方案 A：最小配置（覆盖 3 个平台）

| Agent | 工具 | 任务 |
|-------|------|------|
| Agent 1 | `EnesCinr/twitter-mcp` | 发英文推文线程 |
| Agent 2 | `EnesCinr/twitter-mcp`（中文账号） | 发中文推文线程 |
| Agent 3 | `github/github-mcp-server` 或 `gh` CLI | 提交 awesome-lists PR + 发 GitHub Discussion |

**需要**: Twitter API Keys × 2（中英文账号各一）+ GitHub PAT

### 方案 B：全量覆盖（5+ 个平台）

| Agent | 工具 | 任务 |
|-------|------|------|
| Agent 1 | `taazkareem/twitter-mcp-server` | 发英文推文线程（含媒体） |
| Agent 2 | `taazkareem/twitter-mcp-server` | 发中文推文线程 |
| Agent 3 | `morinokami/mcp-server-bluesky` | Bluesky 发帖 + 互动 |
| Agent 4 | `github/github-mcp-server` | awesome-lists PR + Discussion + Release |
| Agent 5 | `typefully-mcp-server` | LinkedIn + Threads 排程 |
| Agent 6 | 人工 | Reddit + Hacker News 手动提交 |

**需要**: Twitter API Keys + Bluesky App Password + GitHub PAT + Typefully API Key

### 方案 C：Typefully 中心化（最省事）

用一个 Typefully 账号覆盖 X + LinkedIn + Threads + Bluesky + Mastodon，一次草稿 → 多平台分发。

| Agent | 工具 | 任务 |
|-------|------|------|
| Agent 1 | `typefully-mcp-server` | 创建所有社交平台草稿并排程 |
| Agent 2 | `github/github-mcp-server` | GitHub 生态推广 |
| Agent 3 | 人工 | Reddit + HN |

**需要**: Typefully 付费账号 ($12.50+/月) + GitHub PAT

---

## 四、推广目标清单（已有内容）

已准备好的推广内容（位于 `docs/launch-announcement.md`）:

| 内容 | 适用平台 |
|------|---------|
| 英文 Twitter 线程（7 条） | X/Twitter, Bluesky, Threads |
| 中文 Twitter 线程（7 条） | X/Twitter (中文账号), 微博 |
| 英文 1-pager pitch | DM, Email, Discord/Slack |
| 中文 1-pager pitch | DM, 微信群 |
| GitHub Release 公告 | GitHub Discussions, Dev.to |

### 推荐提交的 Awesome Lists

| 仓库 | Stars | 分类 |
|------|-------|------|
| `VoltAgent/awesome-agent-skills` | 12,197 | Marketing Skills → 可加 "Communication" 类别 |
| `alirezarezvani/claude-skills` | 6,141 | 可提交到 protocol 类别 |
| `sindresorhus/awesome` | 340k+ | 需要等项目更成熟 |
| `e2b-dev/awesome-ai-agents` | 12k+ | Multi-agent 类别 |
| `kyrolabs/awesome-langchain` | 7k+ | Agent tools 类别 |

---

## 五、所需凭证汇总

在执行推广前，需要准备以下凭证：

| 凭证 | 用途 | 获取方式 |
|------|------|---------|
| Twitter API Keys (英文账号) | 发推 | https://developer.twitter.com |
| Twitter API Keys (中文账号) | 发中文推 | 同上 |
| Bluesky App Password | 发 Bluesky 帖 | Bluesky Settings > App Passwords |
| GitHub PAT | 提 PR / 发 Discussion | https://github.com/settings/tokens |
| Typefully API Key (可选) | 多平台排程 | Typefully Settings > Integrations |
| Dev.to API Key (可选) | 发技术文章 | https://dev.to/settings/extensions |

---

## 六、草稿 vs 写作辅助工具（参考，非自动化执行）

以下工具帮助**写内容**但不能自动发布，供内容迭代时参考：

| 工具 | GitHub | 用途 |
|------|--------|------|
| `coreyhaines31/marketingskills` → launch-strategy | 原始仓库 | 产品发布策略、GTM 规划 |
| `coreyhaines31/marketingskills` → social-content | 同上 | 社交媒体内容生成 |
| `coreyhaines31/marketingskills` → copywriting | 同上 | 营销文案 |
| `blader/humanizer` (10k stars) | https://github.com/blader/humanizer | 去 AI 味 |
| `deanpeters/Product-Manager-Skills` → press-release | 原始仓库 | Amazon "Working Backwards" 新闻稿 |
