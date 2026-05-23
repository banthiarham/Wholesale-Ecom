import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Set the session ID to match the backend cart we populated via curl
  await page.goto('http://localhost:3001/cart');
  await page.evaluate(() => localStorage.setItem('cart_session', 'demo-session-123'));
  await page.reload();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:\\Users\\deepa\\Wholesale-Ecom\\screenshots\\cart-with-items.png', fullPage: true });

  // Screenshot checkout
  await page.goto('http://localhost:3001/checkout');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:\\Users\\deepa\\Wholesale-Ecom\\screenshots\\checkout-with-items.png', fullPage: true });

  await browser.close();
})();
