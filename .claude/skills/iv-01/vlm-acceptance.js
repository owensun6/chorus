#!/usr/bin/env node
/**
 * Fusion-Core V3: VLM Acceptance Judge (视觉验收判定器)
 *
 * 协议依赖: docs/v3_specs/vlm_protocol.md
 * 作战区域: .claude/skills/iv-01/
 *
 * 职责:
 *   1. 读取 VLM 评分结果
 *   2. 根据分数判定通过/驳回
 *   3. 写入 VLM_Report.md 并更新 monitor.md
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// 配置
// ==========================================
const PASS_THRESHOLD = 90;
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const VLM_REPORT_PATH = path.join(PROJECT_ROOT, 'pipeline/1_5_prototype/VLM_Report.md');
const MONITOR_PATH = path.join(PROJECT_ROOT, 'pipeline/monitor.md');

/**
 * 确保目录存在
 */
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 解析 VLM 返回的 JSON 评分 (从 stdin 或文件读取)
 */
function parseVlmResult(input) {
  try {
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in VLM response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`❌ [IV-01] 无法解析 VLM 评分结果: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 生成 VLM 验收报告 (不可变)
 */
function buildReport(vlmResult) {
  const passed = vlmResult.total_score >= PASS_THRESHOLD;
  const statusEmoji = passed ? '✅' : '❌';
  const statusText = passed ? '通过截图还原度验收' : '未通过截图还原度验收 — 驳回给前端开发群组';

  const breakdown = vlmResult.breakdown || {};
  const breakdownSection = Object.entries(breakdown)
    .map(([key, val]) => {
      const issues =
        (val.issues || []).length > 0
          ? val.issues.map((i) => `  - ${i}`).join('\n')
          : '  - (无问题)';
      return `### ${key}\n- **得分**: ${val.score}\n- **问题**:\n${issues}`;
    })
    .join('\n\n');

  return `<!-- Author: iv-01 -->
# VLM 视觉还原度验收报告

> **生成时间**: ${new Date().toISOString()}
> **验收阈值**: ${PASS_THRESHOLD} 分
> **实际得分**: ${vlmResult.total_score} 分

---

## 验收结论

${statusEmoji} **${statusText}**

---

## 评分明细

${breakdownSection}

---

## 严重问题

${
  (vlmResult.critical_issues || []).length > 0
    ? vlmResult.critical_issues.map((i) => `- ${i}`).join('\n')
    : '无严重问题'
}

---

## 总结

${vlmResult.summary || 'N/A'}

---

*此报告由 iv-01 vlm-acceptance.js 自动生成*
`;
}

/**
 * 更新 monitor.md 中 Gate 1.5a 的状态
 */
function updateMonitor(passed) {
  if (!fs.existsSync(MONITOR_PATH)) {
    console.error(`⚠️ [IV-01] monitor.md 不存在: ${MONITOR_PATH}`);
    return;
  }

  const content = fs.readFileSync(MONITOR_PATH, 'utf-8');

  if (passed) {
    // 在 Gate 1.5 相关区域标注通过
    const updatedContent = content.replace(
      /(\|\s*\*\*1\.5\*\*\s*\|[^|]*\|)\s*⬜ 未开始/,
      '$1 ✅ 已完成',
    );

    if (updatedContent !== content) {
      fs.writeFileSync(MONITOR_PATH, updatedContent, 'utf-8');
      console.log(`✅ [IV-01] monitor.md Gate 1.5a 已标记为通过`);
    } else {
      console.log(`⚠️ [IV-01] monitor.md 中未找到 Gate 1.5 状态位，请手动更新`);
    }
  } else {
    console.log(`❌ [IV-01] 验收未通过，Gate 1.5a 保持未通过状态`);
  }
}

/**
 * 主执行流
 */
function main() {
  console.log(`\n🔍 [IV-01 Acceptance] 启动视觉验收判定`);
  console.log(`   通过阈值: ${PASS_THRESHOLD} 分\n`);

  // 从命令行参数读取 VLM 结果文件，或从 stdin
  const inputFile = process.argv[2];
  let rawInput;

  if (inputFile && fs.existsSync(inputFile)) {
    rawInput = fs.readFileSync(inputFile, 'utf-8');
  } else {
    console.log('   用法: node vlm-acceptance.js <vlm_result.json>');
    console.log('   或通过 stdin 管道传入 VLM JSON 响应');
    process.exit(1);
  }

  const vlmResult = parseVlmResult(rawInput);
  const passed = vlmResult.total_score >= PASS_THRESHOLD;

  console.log(`   📊 VLM 评分: ${vlmResult.total_score} / 100`);
  console.log(`   📋 判定: ${passed ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // 写入 VLM Report
  const report = buildReport(vlmResult);
  ensureDir(VLM_REPORT_PATH);
  fs.writeFileSync(VLM_REPORT_PATH, report, 'utf-8');
  console.log(`   📝 报告已写入: ${VLM_REPORT_PATH}`);

  // 更新 monitor.md
  updateMonitor(passed);

  if (!passed) {
    console.error(
      `\n🚨 [IV-01] 还原度不达标 (${vlmResult.total_score} < ${PASS_THRESHOLD})，驳回给前端开发群组！\n`,
    );
    process.exit(1);
  }

  console.log(`\n✅ [IV-01] 视觉验收通过！Gate 1.5a 绿灯。\n`);
}

main();
