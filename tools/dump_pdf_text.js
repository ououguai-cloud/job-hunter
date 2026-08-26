// 打印 parsePdfToText 提取的真实文本 + 逐条字段匹配测试
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer-core'));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:8621/', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1000));

  const fileInput = await page.$('#pdfInput');
  await fileInput.uploadFile(path.join(__dirname, 'test_resume.pdf'));
  await new Promise(r => setTimeout(r, 4000)); // 等解析+分析完成
  const raw = await page.evaluate(() => document.querySelector('#textArea').value);
  console.log('===== PDF 提取的原始文本（前1200字符，含转义） =====');
  console.log(JSON.stringify(raw.slice(0, 1200)));
  console.log('\n===== 关键行 =====');
  raw.split('\n').slice(0, 30).forEach((l, i) => console.log(String(i).padStart(2), '|', JSON.stringify(l)));
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
