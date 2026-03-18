---
description: 【初始化】在当前项目注入 Fusion-Core 装甲
argument-hint: ''
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# ⛔⛔⛔ 强制前置指令 — 在读完本行后立即执行，不做任何其他操作 ⛔⛔⛔

你的第一个动作（第一个工具调用）必须是运行下面这条 Bash 命令。
不允许先做 Glob、Read、Agent、Grep 或任何其他操作。
不允许"先看看目录结构"。不允许"先了解项目"。不允许"并行扫描"。
**唯一合法的第一步就是执行这条 Bash 命令：**

```
bash ~/.claude/scripts/fusion-init-guard.sh "$(pwd)"
```

## 如果脚本退出码 = 0

继续执行下方的 STEP 1 至 STEP 8。

## 如果脚本退出码 = 1

**立即停止。不执行任何后续步骤。**
将脚本的完整输出原样展示给 Commander，然后等待 Commander 选择 A/B/C。
在 Commander 做出选择之前，禁止调用 Write、Edit、Bash(cp/mv/mkdir) 或任何文件修改工具。

- A) 增量模式 — 仅注入目标项目中尚不存在的文件
- B) 备份模式 — 先执行 `cp -r pipeline/ .fusion-backup-$(date +%Y%m%d-%H%M%S)/` 再全量注入
- C) 取消操作 — 什么都不做

---

# /fusion-init — 在当前项目注入 Fusion-Core 装甲

> 以下步骤仅在安全扫描通过（退出码 0）或 Commander 选择 A/B 后才可执行。

## STEP 1: 检查环境

- 确认当前目录是否已 `git init` → 如没有，执行 `git init`
- 确认是否已有 `package.json` → 如没有，执行 `npm init -y`

## STEP 2: 拉取 Fusion-Core

- 源地址: `https://github.com/owensun6/fusion-core.git`
- clone 到临时目录 `/tmp/fusion-core-$(date +%s)`
- 如果本地已有 `/Users/test2/code/fusion-method/fusion-core/`，直接从本地复制（更快）

## STEP 3: 注入装甲

从 fusion-core 复制以下内容到当前项目：

- **如果 Commander 选择了 A (增量模式): 目标文件已存在则跳过，记录到日志**
- `.claude/` 整个目录（rules, hooks, commands, skills, scripts）
- `pipeline/` 整个目录（8 阶段骨架 + monitor.md 模板 + .gitkeep）
- `_STYLE_GUIDE.md`
- `.markdownlint.json`, `.markdownlintignore`
- `.prettierrc`
- `.coderabbit.yaml`
- `CLAUDE.md`
- `.husky/` 目录
- `eslint.config.mjs`, `jest.config.js`
- `memory/` 骨架目录

**复制 pipeline/ 时必须先 `mkdir -p` 目标目录再复制**。如果 fusion-core 中找不到 `pipeline/` 目录，运行 fallback 脚本：

```bash
bash .claude/scripts/init_pipeline.sh "$(pwd)/pipeline"
```

## STEP 4: 安装依赖

**必须使用 python3 处理 JSON 合并**（禁止用 Node.js 内联脚本，bash 转义会导致语法错误）。

合并逻辑：将 fusion-core 的 `package.json` 中的 devDependencies 合并到当前项目的 `package.json`，已存在的依赖不覆盖。

```bash
python3 << 'PYEOF'
import json, sys, os

src_path = os.environ.get("SRC_PKG", "/tmp/fusion-core/package.json")
dst_path = "package.json"

with open(src_path) as f:
    src = json.load(f)
with open(dst_path) as f:
    dst = json.load(f)

src_dev = src.get("devDependencies", {})
dst_dev = dst.setdefault("devDependencies", {})

added = []
for k, v in src_dev.items():
    if k not in dst_dev:
        dst_dev[k] = v
        added.append(k)

with open(dst_path, "w") as f:
    json.dump(dst, f, indent=2, ensure_ascii=False)
    f.write("\n")

if added:
    print(f"Added {len(added)} deps: {', '.join(added)}")
else:
    print("No new deps to add")
PYEOF
```

合并后运行 `npm install`。

## STEP 5: 配置 .gitignore

- 确保包含: `node_modules/`, `coverage/`, `.ecc_temp/`, `*.log`, `.DS_Store`

## STEP 6: 清理临时文件

- 删除 clone 的临时目录

## STEP 7: 验证

- 确认 `.claude/rules/` 存在
- 确认 `.claude/hooks/` 存在
- 确认 `pipeline/monitor.md` 存在
- 确认 `CLAUDE.md` 存在

## STEP 8: 汇报

- 输出初始化结果摘要
- 提示 Commander 可以开始提需求了
