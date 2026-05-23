import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3001/cart');
  await page.evaluate(() => localStorage.setItem('cart_session', 'demo-session-123'));
  await page.reload();
  await page.waitForTimeout(1500);

  // Apply SAVE10 coupon
  await page.fill('input[placeholder="Enter coupon code"]', 'SAVE10');
  await page.click('button:has-text("Apply")');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'C:\\Users\\deepa\\Wholesale-Ecom\\screenshots\\cart-with-coupon.png', fullPage: true });

  await browser.close();
})();
