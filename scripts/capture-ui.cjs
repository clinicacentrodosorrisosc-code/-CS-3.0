const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-first-run', '--disable-background-networking'],
  });

  for (const [name, width, height] of [
    ['desktop-login.png', 1440, 900],
    ['mobile-login.png', 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(process.env.UI_URL || 'http://127.0.0.1:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(2500);
    const target = path.resolve('.impeccable', 'review', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, fullPage: true });
    await page.close();
  }

  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
