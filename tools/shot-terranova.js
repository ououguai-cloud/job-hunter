/* 生成 Terranova 设计页交付截图（桌面 + 移动） */
const puppeteer = require('puppeteer-core');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8621/design/terranova/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();

  // 桌面 1280
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'screens/v5-terranova-desktop.png' });

  // 菜单展开状态
  await page.click('#menu-open');
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: 'screens/v5-terranova-menu.png' });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 600));

  // 移动 375
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'screens/v5-terranova-mobile.png' });

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
