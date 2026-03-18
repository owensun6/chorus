#!/usr/bin/env node
/**
 * Fusion-Core: Post-Tool-Use Inspection Hook & Pre-Commit Physical Lock
 * 作用: 在 Agent 执行完写入后，或在人类执行 Git Commit 时，物理拦截非法代码。
 */

const fs = require('fs');
const path = require('path');

// 支持 Claude Code 挂载单文件，或 Husky lint-staged 传参多文件
const modifiedFiles = process.env.CLAUDE_MODIFIED_FILE
  ? [process.env.CLAUDE_MODIFIED_FILE]
  : process.argv.slice(2);

if (modifiedFiles.length === 0) {
  process.exit(0);
}

// CLI tooling paths where console.log is the intended output mechanism
const CLI_ALLOWLIST = ['bin/', '.claude/hooks/', '.claude/scripts/', '.claude/skills/', 'tests/'];

const isCliTooling = (filePath) => {
  const rel = path.relative(process.cwd(), path.resolve(filePath));
  return CLI_ALLOWLIST.some((prefix) => rel.startsWith(prefix));
};

let hasError = false;

for (const modifiedFile of modifiedFiles) {
  if (!fs.existsSync(modifiedFile)) continue;

  const fileContent = fs.readFileSync(modifiedFile, 'utf8');
  const ext = path.extname(modifiedFile);

  console.error(`[Fusion Guard] Inspecting: ${modifiedFile}`);

  // ==========================================
  // 1. 文档产出物强制签名审查 (Author Stamp Check)
  // ==========================================
  if (ext === '.md' && modifiedFile.includes('pipeline/')) {
    const authorStampRegex = /^\s*<!--\s*Author:\s*[A-Za-z0-9-]+\s*-->/i;

    if (!authorStampRegex.test(fileContent)) {
      console.error(`\n❌ [VIOLATION] 物理守卫拦截: 发现无源交付物。`);
      console.error(`> 出错文件: ${modifiedFile}`);
      console.error(`> 规则冲突: 违反 document-standards.md 的强制电子签名要求。`);
      console.error(`> 修复要求: 必须在开头第一行添加 \`<!-- Author: [Role] -->\`。`);
      hasError = true;
    }
  }

  // ==========================================
  // 2. 脏代码死区扫描 (Dead Code & TODO Check)
  // Skip for CLI tooling (bin/, hooks, scripts, skills)
  // ==========================================
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext) && !isCliTooling(modifiedFile)) {
    const dirtyPatterns = [
      { regex: /console\.log\(/, desc: '遗留了 console.log 打印语句' },
      { regex: /\/\/\s*TODO:/i, desc: '遗留了 TODO 未决事项' },
      { regex: new RegExp('debug' + 'ger;'), desc: '遗留了 debugger 调试断点' },
    ];

    for (const item of dirtyPatterns) {
      if (item.regex.test(fileContent)) {
        console.error(`\n❌ [VIOLATION] 物理守卫拦截: 代码洁癖审查失败。`);
        console.error(`> 出错文件: ${modifiedFile}`);
        console.error(`> 错误原因: ${item.desc}。`);
        console.error(`> 修复要求: 请擦除所有测试态死区代码后再提交。`);
        hasError = true;
      }
    }
  }
}

if (hasError) {
  console.error(`\n🚨 [Fusion Guard] Physical Lock Activated: Commit Rejected.`);
  process.exit(1);
} else {
  console.error(`✅ [Fusion Guard] Physical Lock Passed.`);
  process.exit(0);
}
