// 截图脚本：打开 Tab4 公司库，展示赛道筛选 + 地区一体栏 + 岗位卡片
const puppeteer = require('puppeteer-core');
const path = require('path');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:8621/', { waitUntil: 'networkidle2', timeout: 60000 });

  // 切到 Tab4 公司库（按文本匹配）
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')];
    const t = tabs.find(x => x.textContent.includes('公司筛选'));
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 勾选赛道 chips（应届生 + 实习生）演示
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#chips-type .chip')];
    const c = chips.find(x => x.textContent.includes('应届生'));
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 展开河南（多城市省）演示省→市联动
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#chips-prov .chip')];
    const c = chips.find(x => x.textContent.includes('河南'));
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'tab4-track-region.png') });

  // 简历分析页截图（Tab1）
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')];
    const t = tabs.find(x => x.textContent.includes('简历分析'));
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'tab1-resume.png') });

  await browser.close();
  console.log('screenshots saved');
})().catch(e => { console.error(e); process.exit(1); });
