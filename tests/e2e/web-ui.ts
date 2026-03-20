// Author: iv-01 — Web UI E2E test via Playwright
// Usage: DASHSCOPE_API_KEY=xxx npx ts-node tests/e2e/web-ui.ts
import { chromium } from "playwright";
import { startDemo } from "../../src/demo/index";

const WEB_PORT = 5100;
const BASE_URL = `http://localhost:${WEB_PORT}`;

// --- Minimal assertion helper ---

const results = { passed: 0, failed: 0 };

const assert = (condition: boolean, name: string, detail?: string): void => {
  if (condition) {
    console.log(`  ✅ ${name}`);
    results.passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    results.failed++;
  }
};

// --- Wait helpers (evaluated as expressions in browser context) ---

const WAIT_SSE = 'document.getElementById("status")?.textContent === "已连接"';

const waitInputClear = (agent: string): string =>
  `(() => { const i = document.querySelector('form[data-agent="${agent}"] input'); return i && i.value === ""; })()`;

const waitAdaptation = (panelId: string): string =>
  `(() => { const p = document.getElementById("${panelId}"); if (!p) return false; const b = p.querySelectorAll(".bg-gray-800"); if (!b.length) return false; const s = b[b.length-1].querySelector("span"); return s && !s.classList.contains("typing") && s.textContent.length > 3 && s.textContent.indexOf("适配中") === -1; })()`;

// --- Main ---

const run = async () => {
  console.log("=== Web UI E2E Test (Playwright) ===\n");

  // 1. Boot demo stack (router :3000 + agents :3001/:3002 + web :5100)
  const demo = await startDemo(WEB_PORT);
  console.log(`[Demo] All servers up — web at ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // ── Test 1: Page loads & SSE connects ──
    console.log("--- Test 1: Page Load & SSE Connection ---");
    await page.goto(BASE_URL);

    const title = await page.title();
    assert(title.includes("Chorus"), `Page title contains "Chorus" (got "${title}")`);

    await page.waitForFunction(WAIT_SSE, { timeout: 5000 });
    assert(true, "SSE connected (status: 已连接)");

    // Verify both panels exist
    const zhPanel = page.locator("#msgs-zh");
    const jaPanel = page.locator("#msgs-ja");
    assert(await zhPanel.count() === 1, "zh-CN panel exists");
    assert(await jaPanel.count() === 1, "ja panel exists");

    // ── Test 2: Send message zh-CN → ja ──
    console.log("\n--- Test 2: Send Message (zh-CN → ja) ---");
    const zhInput = page.locator('form[data-agent="agent-zh-cn"] input');
    const zhButton = page.locator('form[data-agent="agent-zh-cn"] button');

    await zhInput.fill("你好，今天天气不错");
    await zhButton.click();

    await page.waitForFunction(waitInputClear("agent-zh-cn"), { timeout: 5000 });
    assert(true, "Input cleared after send");

    // Sent bubble (blue, right-aligned) appears in zh panel
    const sentBubble = zhPanel.locator(".bg-blue-600").first();
    await sentBubble.waitFor({ timeout: 5000 });
    const sentText = await sentBubble.innerText();
    assert(sentText.includes("你好，今天天气不错"), "Sent bubble appears with correct text");

    // Wait for adaptation to finish in ja panel (LLM call, up to 30s)
    console.log("  ⏳ Waiting for LLM adaptation...");
    await page.waitForFunction(waitAdaptation("msgs-ja"), { timeout: 30000 });

    const receivedBubble = jaPanel.locator(".bg-gray-800").last();
    const receivedText = await receivedBubble.innerText();
    assert(
      receivedText.length > 0 && !receivedText.includes("适配中"),
      `Adapted message in ja panel: "${receivedText.substring(0, 80)}"`,
    );

    // ── Test 3: Metadata toggle on received bubble ──
    console.log("\n--- Test 3: Metadata Toggle ---");
    const metaBtn = receivedBubble.locator("button");
    const metaBtnCount = await metaBtn.count();
    assert(metaBtnCount > 0, "Metadata toggle button exists on received bubble");

    if (metaBtnCount > 0) {
      await metaBtn.click();
      const metaDiv = receivedBubble.locator(".msg-meta");
      const isOpen = await metaDiv.evaluate((el) => el.classList.contains("open"));
      assert(isOpen, "Metadata panel opens on click");

      const metaContent = await metaDiv.innerText();
      assert(metaContent.includes("原始文本"), 'Metadata shows "原始文本" field');
      assert(metaContent.includes("文化语境"), 'Metadata shows "文化语境" field');

      await metaBtn.click();
      const isClosed = await metaDiv.evaluate((el) => !el.classList.contains("open"));
      assert(isClosed, "Metadata panel closes on second click");
    }

    // ── Test 4: Send message ja → zh-CN ──
    console.log("\n--- Test 4: Send Message (ja → zh-CN) ---");
    const jaInput = page.locator('form[data-agent="agent-ja"] input');
    const jaButton = page.locator('form[data-agent="agent-ja"] button');

    await jaInput.fill("今日はいい天気ですね");
    await jaButton.click();

    await page.waitForFunction(waitInputClear("agent-ja"), { timeout: 5000 });
    assert(true, "ja input cleared after send");

    // Wait for adapted response in zh panel
    console.log("  ⏳ Waiting for LLM adaptation...");
    await page.waitForFunction(waitAdaptation("msgs-zh"), { timeout: 60000 });

    const zhReceivedBubble = zhPanel.locator(".bg-gray-800").last();
    const zhReceivedText = await zhReceivedBubble.innerText();
    assert(
      zhReceivedText.length > 0 && !zhReceivedText.includes("适配中"),
      `Adapted message in zh panel: "${zhReceivedText.substring(0, 80)}"`,
    );

    // ── Test 5: Empty input blocked by HTML required ──
    console.log("\n--- Test 5: Empty Input Validation ---");
    const bubblesBefore = await zhPanel.locator(".bg-blue-600").count();
    await zhInput.fill("");
    await zhButton.click();
    await page.waitForTimeout(500);
    const bubblesAfter = await zhPanel.locator(".bg-blue-600").count();
    assert(bubblesBefore === bubblesAfter, "Empty message blocked (no new sent bubble)");

    // ── Screenshot ──
    await page.screenshot({ path: "tests/e2e/web-ui-screenshot.png", fullPage: true });
    console.log("\n  📸 Screenshot: tests/e2e/web-ui-screenshot.png");

  } finally {
    await browser.close();
    await demo.shutdown();
  }

  console.log(`\n=== Results: ${results.passed} passed, ${results.failed} failed ===`);
  process.exit(results.failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error("Web UI E2E failed:", err);
  process.exit(1);
});
