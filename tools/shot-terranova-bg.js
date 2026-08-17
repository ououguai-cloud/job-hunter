// 截图：Terranova 背景整合后的职聘通主站效果
// 桌面分析页 / 岗位推荐 / 公司筛选 / 移动端
const puppeteer = require('puppeteer-core');
const path = require('path');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.goto('http://127.0.0.1:8621/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof JH !== 'undefined' && JH.jobs.length >= 5000, { timeout: 30000 });
  // 等视频解码 + 折射画布写入
  await page.waitForFunction(() => {
    const v = document.getElementById('bg-video');
    return v && v.videoWidth > 0;
  }, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));

  // 1) 分析页（默认）
  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'v6-bg-analysis.png') });

  // 2) 岗位推荐
  await page.evaluate(() => document.querySelector('.tab[data-tab="recommend"]').click());
  await page.waitForFunction(() => document.querySelectorAll('#recList .job-card').length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'v6-bg-recommend.png') });

  // 3) 公司筛选（滚动到中部看玻璃卡与内容叠加）
  await page.evaluate(() => document.querySelector('.tab[data-tab="jobs"]').click());
  await page.waitForFunction(() => document.querySelectorAll('#jobList .job-card').length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'v6-bg-jobs.png') });

  // 4) 移动端 375
  await page.setViewport({ width: 375, height: 720 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(__dirname, '..', 'screens', 'v6-bg-mobile.png') });

  await browser.close();
  console.log('screens saved');
})().catch(e => { console.error(e); process.exit(1); });
