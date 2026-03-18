#!/usr/bin/env node
/**
 * Fusion-Core V3: VLM Screenshot Capture (Playwright 截图)
 *
 * 协议依赖: docs/v3_specs/vlm_protocol.md
 * 作战区域: .claude/skills/iv-01/
 *
 * 职责: 启动 Playwright 无头浏览器，截取目标页面全尺寸截图
 * 产出: screenshot_current.png
 *
 * 安全: 使用 Playwright API 直接调用，URL 参数严格校验，无临时文件注入
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// 配置
// ==========================================
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'pipeline/1_5_prototype');
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'screenshot_current.png');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 严格校验 URL 参数
 * @param {string} url
 * @returns {string} 校验通过的 URL
 * @throws {Error} 如果 URL 不合法
 */
function validateUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('URL 参数不能为空');
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`URL 必须以 http:// 或 https:// 开头，收到: "${url}"`);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`仅允许 http/https 协议，收到: "${parsed.protocol}"`);
    }
    return parsed.href;
  } catch (e) {
    if (e.code === 'ERR_INVALID_URL') {
      throw new Error(`URL 格式无效: "${url}"`, { cause: e });
    }
    throw e;
  }
}

/**
 * 使用 Playwright API 直接截图（无临时文件注入）
 */
async function captureScreenshot(url, outputPath) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error('❌ [IV-01] Playwright 未安装。请执行:');
    console.error('   npm install --save-dev playwright');
    console.error('   npx playwright install chromium');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`   截图已保存: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const rawUrl = process.argv[2] || 'http://localhost:3000';

  console.log(`\n📸 [IV-01 Screenshot] 启动 Playwright 截图`);
  console.log(`   目标 URL: ${rawUrl}`);
  console.log(`   输出路径: ${SCREENSHOT_PATH}\n`);

  const validatedUrl = validateUrl(rawUrl);
  ensureDir(OUTPUT_DIR);

  try {
    await captureScreenshot(validatedUrl, SCREENSHOT_PATH);
    console.log(`\n✅ [IV-01] 截图完成: ${SCREENSHOT_PATH}\n`);
  } catch (error) {
    console.error(`\n❌ [IV-01] 截图失败: ${error.message}`);
    console.error(`   请确保 Playwright 已安装: npx playwright install chromium`);
    process.exit(1);
  }
}

module.exports = { validateUrl };

if (require.main === module) {
  main();
}
