import { test, expect } from '@playwright/test';

test('login and open vendas page', async ({ page }) => {
  const browserErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') browserErrors.push(msg.text()); });
  page.on('pageerror', err => browserErrors.push(err.message));

  await page.goto('http://localhost:4175/login');
  await page.fill('input[name="login"]', 'command2');
  await page.fill('input[name="senha"]', '4mXKRS7F');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(1200);

  await page.goto('http://localhost:4175/vendas');
  await expect(page.locator('text=Vendas')).toBeVisible({ timeout: 15000 });

  await page.goto('http://localhost:4175/vendas?id_lote=1571');
  await page.waitForTimeout(1500);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(20);

  if (browserErrors.length) {
    console.log('BROWSER_ERRORS=' + JSON.stringify(browserErrors));
  }

  await page.screenshot({ path: 'C:/Projetos Web/SisLotes/.runlogs/vendas-e2e.png', fullPage: true });
});
