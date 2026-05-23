const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'admin@wholesalex.com');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3001/', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const pages = [
    { url: 'http://localhost:3001/vendor/dashboard', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/vendor-dashboard.png' },
    { url: 'http://localhost:3001/vendor/inventory', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/vendor-inventory.png' },
    { url: 'http://localhost:3001/vendor/rfqs', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/vendor-rfqs.png' },
    { url: 'http://localhost:3001/vendor/orders', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/vendor-orders.png' },
    { url: 'http://localhost:3001/rfqs', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/rfqs.png' },
    { url: 'http://localhost:3001/catalogs', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/catalogs.png' },
    { url: 'http://localhost:3001/orders/bulk-upload', path: 'C:/Users/deepa/Wholesale-Ecom/screenshots/bulk-upload.png' },
  ];

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: p.path, fullPage: false });
    console.log('Saved', p.path);
  }

  await browser.close();
})();
