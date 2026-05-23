import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Login as admin
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'admin@wholesalex.com');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);

  const shots = [
    { url: 'http://localhost:3001/rfqs', path: 'screenshots/rfqs-auth.png' },
    { url: 'http://localhost:3001/rfqs/new', path: 'screenshots/rfqs-new.png' },
    { url: 'http://localhost:3001/vendor/dashboard', path: 'screenshots/vendor-dashboard-auth.png' },
    { url: 'http://localhost:3001/vendor/products', path: 'screenshots/vendor-products.png' },
    { url: 'http://localhost:3001/vendor/inventory', path: 'screenshots/vendor-inventory-auth.png' },
    { url: 'http://localhost:3001/vendor/rfqs', path: 'screenshots/vendor-rfqs.png' },
  ];

  for (const shot of shots) {
    await page.goto(shot.url);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shot.path, fullPage: true });
    console.log(`Screenshot: ${shot.path}`);
  }

  await browser.close();
})();
