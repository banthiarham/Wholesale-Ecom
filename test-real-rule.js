const { chromium } = require("playwright")
const SCRATCH = "C:/Users/NIKHIL/AppData/Local/Temp/claude/C--WINDOWS-system32/3c1d0171-5ea8-4f2d-b700-277be760572e/scratchpad"

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" })
  const form = page.locator("form").filter({ hasText: "Sign In" })
  await form.getByPlaceholder("you@example.com").fill("buyer2@wholesalex.com")
  await form.locator('input[type="password"]').fill("Buyer2@123")
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.getByRole("button", { name: "Sign In", exact: true }).click(),
  ])
  await page.waitForTimeout(1000)

  await page.goto("http://localhost:3001/products/zebronics-bt-earbuds-24hrs-zeb-pods-s1-40-pcs-msmy2exg", { waitUntil: "networkidle" })
  let badgeAppeared = false
  try {
    await page.waitForSelector("text=10% OFF", { timeout: 8000 })
    badgeAppeared = true
  } catch {}
  console.log("Badge '10% OFF' visible immediately (no interaction):", badgeAppeared)
  await page.screenshot({ path: SCRATCH + "/real-rule-fixed.png" })

  await browser.close()
})()
