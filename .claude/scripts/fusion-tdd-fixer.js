#!/usr/bin/env node
/**
 * Fusion-Core V3: TDD Self-Healing Shell (自愈壳程序)
 *
 * 协议依赖: docs/v3_specs/healing_protocol.md
 * 作战区域: .claude/scripts/
 *
 * 职责:
 *   1. 截获 fusion-tdd 测试执行中退出码 > 0 的报错流
 *   2. 分析 Jest 输出，提取错误信息和修复指引
 *   3. 格式化写出到 pipeline/3_review/Auto_Heal_Log.json
 *   4. 3 次循环熔断器 — 失败 3 次生成 Panic_Report.md 并中断
 *
 * 退出码语义:
 *   0 = 全绿（测试通过）
 *   1 = 有红灯但可修复
 *   2 = 熔断（超过最大重试次数）
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ==========================================
// 配置常量
// ==========================================
const MAX_RETRIES = 3;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const HEAL_LOG_PATH = path.join(PROJECT_ROOT, 'pipeline/3_review/Auto_Heal_Log.json');
const PANIC_REPORT_PATH = path.join(PROJECT_ROOT, 'pipeline/3_review/Panic_Report.md');

const args = process.argv.slice(2);
const ANALYZE_ONLY = args.includes('--analyze-only');
const TEST_SCRIPT = args.find((a) => a !== '--analyze-only') || 'test';

// ==========================================
// 工具函数 (纯函数, 不可变)
// ==========================================

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getGitDiff() {
  try {
    return execFileSync('git', ['diff', '--stat'], {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
    }).trim();
  } catch {
    return '[git diff unavailable]';
  }
}

// ==========================================
// 分析引擎 (Analysis Engine)
// ==========================================

/**
 * 解析 Jest/测试框架输出，提取结构化错误信息
 */
function analyzeTestOutput(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;

  const failedFilePattern = /FAIL\s+(\S+\.(?:test|spec)\.\w+)/g;
  const failedFiles = [];
  for (const match of combined.matchAll(failedFilePattern)) {
    failedFiles.push(match[1]);
  }

  const failedTestPattern = /●\s+(.+)/g;
  const failedTestNames = [];
  for (const match of combined.matchAll(failedTestPattern)) {
    failedTestNames.push(match[1].trim());
  }

  const assertionPattern = /Expected:\s*(.+)\s*\n\s*Received:\s*(.+)/g;
  const assertions = [];
  for (const match of combined.matchAll(assertionPattern)) {
    assertions.push({ expected: match[1].trim(), received: match[2].trim() });
  }

  const errorTypePattern =
    /(TypeError|ReferenceError|SyntaxError|RangeError|AssertionError):\s*(.+)/g;
  const errors = [];
  for (const match of combined.matchAll(errorTypePattern)) {
    errors.push({ type: match[1], message: match[2].trim() });
  }

  const locationPattern = /at\s+\S+\s+\(([^)]+):(\d+):(\d+)\)/g;
  const locations = [];
  for (const match of combined.matchAll(locationPattern)) {
    locations.push({ file: match[1], line: Number(match[2]), column: Number(match[3]) });
  }

  const summaryPattern = /Tests:\s*(?:(\d+)\s*failed,?\s*)?(?:(\d+)\s*passed,?\s*)?(\d+)\s*total/;
  const summaryMatch = combined.match(summaryPattern);
  const summary = summaryMatch
    ? {
        failed: Number(summaryMatch[1] || 0),
        passed: Number(summaryMatch[2] || 0),
        total: Number(summaryMatch[3] || 0),
      }
    : { failed: 0, passed: 0, total: 0 };

  return Object.freeze({
    failedFiles,
    failedTestNames,
    assertions,
    errors,
    locations,
    summary,
  });
}

/**
 * 根据错误模式生成修复指引
 */
function buildFixGuidance(analysis) {
  const guidance = [];

  for (const err of analysis.errors) {
    if (err.type === 'TypeError') {
      guidance.push({
        category: 'type-error',
        guidance: `类型错误: ${err.message}. 检查变量类型定义和函数参数签名。`,
        source: analysis.locations[0]?.file || null,
      });
    } else if (err.type === 'ReferenceError') {
      guidance.push({
        category: 'missing-reference',
        guidance: `引用缺失: ${err.message}. 检查 import/require 语句和变量声明。`,
        source: analysis.locations[0]?.file || null,
      });
    } else if (err.type === 'SyntaxError') {
      guidance.push({
        category: 'syntax-error',
        guidance: `语法错误: ${err.message}. 检查括号、分号等基础语法。`,
        source: analysis.locations[0]?.file || null,
      });
    } else {
      guidance.push({
        category: 'runtime-error',
        guidance: `运行时错误 (${err.type}): ${err.message}`,
        source: analysis.locations[0]?.file || null,
      });
    }
  }

  for (const assertion of analysis.assertions) {
    guidance.push({
      category: 'assertion-failure',
      guidance: `断言失败: 期望 ${assertion.expected}，实际 ${assertion.received}. 检查对应实现函数的返回值。`,
      source: analysis.failedFiles[0] || null,
    });
  }

  if (guidance.length === 0 && analysis.failedFiles.length > 0) {
    guidance.push({
      category: 'unknown',
      guidance: `测试失败但未能自动分类错误类型。请检查: ${analysis.failedFiles.join(', ')}`,
      source: analysis.failedFiles[0] || null,
    });
  }

  return Object.freeze(guidance);
}

// ==========================================
// 快照与日志
// ==========================================

function createErrorSnapshot({ exitCode, stderr, stdout, attempt, analysis, fixGuidance }) {
  return Object.freeze({
    timestamp: new Date().toISOString(),
    attempt,
    exitCode,
    errorOutput: stderr.slice(0, 5000),
    testOutput: stdout.slice(0, 3000),
    gitDiff: getGitDiff(),
    analysis: analysis || null,
    fixGuidance: fixGuidance || [],
  });
}

function readExistingLog() {
  if (fs.existsSync(HEAL_LOG_PATH)) {
    try {
      const raw = fs.readFileSync(HEAL_LOG_PATH, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { session: [], metadata: {} };
    }
  }
  return { session: [], metadata: {} };
}

function writeHealLog(existingLog, newSnapshot) {
  const updatedLog = Object.freeze({
    metadata: {
      lastUpdated: new Date().toISOString(),
      testCommand: `npm run ${TEST_SCRIPT}`,
      totalAttempts: existingLog.session.length + 1,
    },
    session: [...existingLog.session, newSnapshot],
  });

  ensureDir(HEAL_LOG_PATH);
  fs.writeFileSync(HEAL_LOG_PATH, JSON.stringify(updatedLog, null, 2), 'utf-8');
  return updatedLog;
}

function writePanicReport(healLog) {
  const errorSections = healLog.session
    .map((s, i) => {
      const guidanceText = (s.fixGuidance || [])
        .map((g) => `  - [${g.category}] ${g.guidance}`)
        .join('\n');
      return `### 第 ${i + 1} 次尝试 (${s.timestamp})\n- **退出码**: ${s.exitCode}\n- **错误输出**:\n\`\`\`\n${s.errorOutput.slice(0, 1500)}\n\`\`\`\n- **修复指引**:\n${guidanceText || '  - (无自动分析结果)'}`;
    })
    .join('\n\n');

  const lastDiff = healLog.session[healLog.session.length - 1]?.gitDiff || 'N/A';

  const report = `<!-- Author: Dev -->
# Panic Report — TDD 自愈熔断

> **生成时间**: ${new Date().toISOString()}
> **测试命令**: \`npm run ${TEST_SCRIPT}\`
> **总尝试次数**: ${healLog.session.length}

---

## 熔断原因

同一任务在自动循环了 **${MAX_RETRIES} 次** 之后仍然为红色。
根据 \`healing_protocol.md\` 第 4 条（逃逸阈值），强制交还给人肉统帅 (Commander)。

---

## 错误摘要

${errorSections}

---

## Git Diff (最后一次)

\`\`\`
${lastDiff}
\`\`\`

---

## 建议路由

1. TypeScript 类型报错 → 路由回 \`fe-logic-binder\`
2. HTTP 500 连接报错 → 路由至 \`be-api-router\` 或 \`be-domain-modeler\`
3. DOM 节点缺失 → 路由回 \`fe-ui-builder\`
4. 修复后重新执行 \`/fusion-tdd\`

---

*此报告由 fusion-tdd-fixer.js 自动生成*
`;

  ensureDir(PANIC_REPORT_PATH);
  fs.writeFileSync(PANIC_REPORT_PATH, report, 'utf-8');
}

function runTest() {
  try {
    const stdout = execFileSync('npm', ['run', TEST_SCRIPT], {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      exitCode: error.status || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
    };
  }
}

// ==========================================
// 主执行流
// ==========================================

function main() {
  if (ANALYZE_ONLY) {
    const result = runTest();
    if (result.exitCode === 0) {
      const output = JSON.stringify({ status: 'green', analysis: null, fixGuidance: [] }, null, 2);
      process.stdout.write(output + '\n');
      process.exit(0);
    }
    const analysis = analyzeTestOutput(result.stdout, result.stderr);
    const fixGuidance = buildFixGuidance(analysis);
    const output = JSON.stringify(
      { status: 'red', exitCode: result.exitCode, analysis, fixGuidance },
      null,
      2,
    );
    process.stdout.write(output + '\n');
    process.exit(1);
  }

  console.log(`\n⚡ [Fusion TDD Fixer] 启动自愈循环`);
  console.log(`   测试命令: npm run ${TEST_SCRIPT}`);
  console.log(`   熔断阈值: ${MAX_RETRIES} 次\n`);

  let healLog = readExistingLog();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`🔄 [第 ${attempt}/${MAX_RETRIES} 次] 执行测试...`);

    const result = runTest();

    if (result.exitCode === 0) {
      console.log(`\n✅ [Fusion TDD Fixer] 测试全部通过！退出自愈循环。\n`);
      process.exit(0);
    }

    console.error(`❌ [第 ${attempt} 次] 测试失败 (退出码: ${result.exitCode})`);

    const analysis = analyzeTestOutput(result.stdout, result.stderr);
    const fixGuidance = buildFixGuidance(analysis);

    console.error(
      `   📊 分析结果: ${analysis.failedFiles.length} 个文件失败, ${analysis.errors.length} 个错误`,
    );
    for (const g of fixGuidance) {
      console.error(`   💡 [${g.category}] ${g.guidance}`);
    }

    const snapshot = createErrorSnapshot({
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      attempt,
      analysis,
      fixGuidance,
    });

    healLog = writeHealLog(healLog, snapshot);
    console.log(`   📝 错误快照已写入: ${HEAL_LOG_PATH}`);

    if (attempt < MAX_RETRIES) {
      console.log(`   ⏳ 等待修复兵种介入后重试...\n`);
    }
  }

  console.error(`\n🚨 [CIRCUIT BREAKER] 已达到最大重试次数 (${MAX_RETRIES})！`);
  console.error(`   生成 Panic Report 并交还 Commander...\n`);

  writePanicReport(healLog);
  console.error(`   📋 Panic Report 已写入: ${PANIC_REPORT_PATH}`);
  console.error(`   🛑 脚本中断，等待人类指挥官介入。\n`);

  process.exit(2);
}

module.exports = {
  analyzeTestOutput,
  buildFixGuidance,
  createErrorSnapshot,
  readExistingLog,
  writeHealLog,
  writePanicReport,
  runTest,
  ensureDir,
  getGitDiff,
  main,
  MAX_RETRIES,
};

if (require.main === module) {
  main();
}
