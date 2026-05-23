const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const pages = [
    { url: 'http://localhost:3001/', name: 'home' },
    { url: 'http://localhost:3001/products', name: 'products' },
    { url: 'http://localhost:3001/products/wireless-earbuds-pro', name: 'product-detail' },
    { url: 'http://localhost:3001/categories/electronics', name: 'category' },
    { url: 'http://localhost:3001/login', name: 'login' },
    { url: 'http://localhost:3001/register', name: 'register' },
    { url: 'http://localhost:3001/forgot-password', name: 'forgot-password' },
    { url: 'http://localhost:3001/verify-otp', name: 'verify-otp' },
    { url: 'http://localhost:3001/cart', name: 'cart' },
    { url: 'http://localhost:3001/checkout', name: 'checkout' },
    { url: 'http://localhost:3001/orders', name: 'orders' },
  ];

  for (const p of pages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshot-' + p.name + '.png', fullPage: true });
      console.log('OK:', p.name);
    } catch (e) {
      console.log('FAIL:', p.name, e.message);
    }
  }

  await browser.close();
  console.log('Done');
})();
