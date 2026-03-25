const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:4176', { waitUntil: 'networkidle2' });

  console.log('Typing credentials...');
  await page.waitForSelector('input[placeholder="Seu usuário"]');
  await page.type('input[placeholder="Seu usuário"]', 'zelia'); // Assuming username input
  await page.type('input[type="password"]', 'euquerovedeus');
  
  await page.click('button[type="submit"]');
  
  console.log('Waiting for navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  console.log('Clicking /clientes link in sidebar...');
  await page.click('a[href="/clientes"]');

  console.log('Waiting for table...');
  await page.waitForSelector('table', { timeout: 10000 });

  console.log('Looking for view button...');
  try {
    await page.waitForSelector('button[title="Visualizar"]', { timeout: 10000 });
    console.log('Clicking view button...');
    await page.click('button[title="Visualizar"]');
  } catch (err) {
    console.log('Button not found, saving html...');
    const fs = require('fs');
    fs.writeFileSync('page_dump.html', await page.content());
    await browser.close();
    return;
  }

  console.log('Waiting to see if it crashes...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const content = await page.content();
  if (content.includes('Application Error') || content.includes('Uncaught Error')) {
    console.log('CRASH DETECTED in HTML!');
  }
  
  console.log('Done.');
  await browser.close();
})();
