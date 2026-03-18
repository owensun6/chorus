#!/usr/bin/env node
/**
 * Fusion-Core: Pre-Tool-Use Guard Hook
 * 作用: 在 Agent 执行工具(如写文件、发命令)前拦截恶意操作或低级失误。
 */

const fs = require('fs');
const path = require('path');

// 提取工具名和参数 (Claude Code 传递的上下文视具体集成方案而定，这里模拟通过环境变量/参数读取)
const toolName = process.env.CLAUDE_TOOL_NAME || '';
const toolArgs = process.env.CLAUDE_TOOL_ARGS || '';

console.error(`[Fusion Guard] PreToolUse triggered for: ${toolName}`);

// ==========================================
// 1. API 密钥与敏感信息防泄漏拦截 (Secret Scanning)
// ==========================================
const secretPatterns = [
  /sk-ant-[a-zA-Z0-9_-]{40,}/, // Anthropic API Key
  /sk-[a-zA-Z0-9]{40,}/, // OpenAI API Key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub Personal Access Token
  /password\s*[:=]\s*["'][^"']{5,}["']/i, // Hardcoded password
];

for (const pattern of secretPatterns) {
  if (pattern.test(toolArgs)) {
    console.error(`\n🚨 [FATAL ERROR] 物理守卫拦截: 检测到疑似硬编码的 Secret (API Key 或密码)。`);
    console.error(`> 规则冲突: 违反 security.md 第 1 条 [硬编码断头台]。`);
    console.error(`> 强制阻断执行。请使用读取环境变量等脱敏方式。`);
    process.exit(1);
  }
}

// ==========================================
// 2. 兵种工具权限降维 (Role-Based Tool Stripping)
// ==========================================
const currentRole = process.env.FUSION_ROLE || '';
const writeTools = ['write_file', 'replace_file', 'multi_replace'];

if (currentRole && writeTools.includes(toolName)) {
  const isCode = /\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(toolArgs);
  // QA 审查官和 PM 绝对不能修改源代码
  if ((currentRole.startsWith('qa-') || currentRole === 'pm') && isCode) {
    console.error(`\n🚨 [FATAL ERROR] 物理守卫拦截: 兵种级别工具越权！`);
    console.error(`> 当前角色: [${currentRole}]`);
    console.error(`> 规则冲突: 审查官和 PM 的 File Write 工具被物理褫夺，无权修改源代码。`);
    console.error(`> 请仅使用 Read 或 Grep 工具提出修改建议，或者移交 Dev 处理。`);
    process.exit(1);
  }
}

// ==========================================
// 3. Stage 突破防腐层 (Stage Skipping Guard)
// ==========================================
// 如果特种兵试图写代码 (Stage 5)，我们要判断是不是连架构都没定 (Stage 1)。
if (toolName === 'write_file' || toolName === 'replace_file') {
  const isCodeFile = /\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(toolArgs);

  if (isCodeFile) {
    const interfaceMapPath = path.join(process.cwd(), 'pipeline/1_architecture/INTERFACE.md');
    // 如果是写业务代码，且不是测试代码
    if (!toolArgs.includes('.test.') && !toolArgs.includes('.spec.')) {
      if (!fs.existsSync(interfaceMapPath)) {
        console.error(`\n🚨 [FATAL ERROR] 物理守卫拦截: 试图越级编写生产代码。`);
        console.error(`> 规则冲突: 违反 00-fusion-workflow.md 中的 [防跳关硬约束]。`);
        console.error(
          `> 错误原因: 缺失 Stage 1 产物 \`pipeline/1_architecture/INTERFACE.md\`。必须先过架构关！`,
        );
        process.exit(1);
      }
    }
  }
}

// ==========================================
// 4. 跨模型智能路由 (Cost-Aware Model Routing)
// ==========================================
// 协议依赖: docs/v3_specs/routing_protocol.md
// 使用共享路由模块 (lib/model-routing.js)

const { getRoute } = require('../../lib/model-routing');

if (currentRole) {
  const routeEntry = getRoute(currentRole);
  if (routeEntry) {
    // 仅通过 stderr 输出日志，不再假装设置环境变量
    if (routeEntry.tier === 'light') {
      console.error(`\n⚡ 自动路由至经济模型执行，以节省 Token`);
      console.error(`   当前兵种: [${currentRole}] → 模型: [${routeEntry.model}]`);
      console.error(`   路由理由: ${routeEntry.reason}`);
    } else {
      console.error(
        `[Fusion Router] 兵种 [${currentRole}] → 模型 [${routeEntry.model}] (${routeEntry.tier})`,
      );
    }
  }
}

// 如果所有检查通过，放行
console.error(`✅ [Fusion Guard] Pre-check passed.`);
process.exit(0);
