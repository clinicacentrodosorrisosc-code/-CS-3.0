const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const axe = require('axe-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = process.env.UI_URL || 'http://127.0.0.1:3000';
const OUTPUT_PATH = path.resolve('.impeccable', 'review', 'ui-audit.json');

async function auditViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(1_500);
  await page.addScriptTag({ content: axe.source });

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
  }));
  const accessibility = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
    }));
  });

  await page.close();
  return { name, viewport, layout, runtimeErrors, accessibility };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-first-run', '--disable-background-networking'],
  });
  const results = [];
  try {
    results.push(await auditViewport(browser, 'desktop', { width: 1440, height: 900 }));
    results.push(await auditViewport(browser, 'mobile', { width: 390, height: 844 }));
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), url: BASE_URL, results }, null, 2));

  const failures = results.flatMap(result => [
    ...(result.layout.horizontalOverflow ? [`${result.name}: horizontal overflow`] : []),
    ...result.runtimeErrors.map(error => `${result.name}: runtime error: ${error}`),
    ...result.accessibility
      .filter(violation => violation.impact === 'critical' || violation.impact === 'serious')
      .map(violation => `${result.name}: ${violation.impact} accessibility violation: ${violation.id}`),
  ]);

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`UI audit passed for ${results.length} viewports. Report: ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
