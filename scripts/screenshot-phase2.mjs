import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const shots = [
    { url: 'http://localhost:3001/rfqs', path: 'screenshots/rfqs-list.png' },
    { url: 'http://localhost:3001/catalogs', path: 'screenshots/catalogs-list.png' },
    { url: 'http://localhost:3001/orders/bulk-upload', path: 'screenshots/bulk-upload.png' },
    { url: 'http://localhost:3001/vendor/dashboard', path: 'screenshots/vendor-dashboard.png' },
    { url: 'http://localhost:3001/vendor/inventory', path: 'screenshots/vendor-inventory.png' },
  ];

  for (const shot of shots) {
    await page.goto(shot.url);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shot.path, fullPage: true });
    console.log(`Screenshot: ${shot.path}`);
  }

  await browser.close();
})();
