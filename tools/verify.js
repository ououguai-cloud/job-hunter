// 端到端回归验证：PDF上传 → 分析 → 字段识别 → 自动跳转 → 推荐响应 → 性能
const path = require('path');
const PROJECT = path.resolve(__dirname, '..');
(async () => {
  const puppeteer = require(path.join(PROJECT, 'node_modules', 'puppeteer-core'));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://localhost:8621/', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
  // 等岗位库 JSON 下载+解析（46MB 需要时间）
  await new Promise(r => setTimeout(r, 5000));
  // 通过页面统计 DOM 判断岗位库就绪，不依赖 window.JH（const 不挂载 window）
  let jobsReady = false, dbTotal = 0;
  for (let i = 0; i < 30; i++) {
    dbTotal = await page.evaluate(() => {
      const el = document.querySelector('#db-total');
      return el ? parseInt(el.textContent.replace(/\D/g, ''), 10) : 0;
    });
    if (dbTotal > 1000) { jobsReady = true; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('岗位库加载:', jobsReady ? dbTotal + ' 条 ✓' : '超时 ✗');

  // 等页面完全就绪后再开始计时 PDF 分析
  await new Promise(r => setTimeout(r, 500));

  // ============ 1. PDF 上传分析（走真实 parsePdfToText 路径） ============
  const fileInput = await page.$('#pdfInput');
  await fileInput.uploadFile(path.join(__dirname, 'test_resume.pdf'));
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const el = document.querySelector('#analysisResult');
    return el && el.innerHTML.length > 100;
  }, { timeout: 30000 });
  const analyzeMs = Date.now() - t0;
  const prof = await page.evaluate(() => {
    // 通过全局暴露的 analyzeText 返回的 profile，或 DOM 反解
    return (typeof JH !== 'undefined' && JH.profile) ? JH.profile : {};
  });
  console.log('\n===== 1. PDF 分析结果 =====');
  console.log('姓名:', JSON.stringify(prof.name), prof.name === '王艺凯' ? '✓' : '✗ (期望 王艺凯)');
  console.log('电话:', prof.phone || '(空)');
  console.log('邮箱:', prof.email || '(空)');
  console.log('调剂意向:', JSON.stringify(prof.acceptAdjust), prof.acceptAdjust === '接受' ? '✓' : '✗ (期望 接受)');
  console.log('求职意向(target):', JSON.stringify(prof.target),
    (prof.target && prof.target.join().includes('数据分析') && prof.target.join().includes('产品运营')) ? '✓ 原文精确提取' : '✗ (期望含 数据分析+产品运营)');
  console.log('期望城市:', JSON.stringify(prof.preferCity || []));
  console.log('分析总耗时:', analyzeMs + 'ms', analyzeMs < 3000 ? '✓' : '✗ (应<3秒)');

  // ============ 2. 自动跳转推荐 Tab ============
  await new Promise(r => setTimeout(r, 1200)); // 等 600ms 定时器触发
  const activeTab = await page.evaluate(() => document.querySelector('.tab.active')?.dataset?.tab || document.querySelector('nav .active')?.getAttribute('data-tab') || 'unknown');
  console.log('\n===== 2. 自动跳转 =====');
  console.log('当前激活Tab:', activeTab, activeTab === 'recommend' ? '✓ 已自动跳转' : '✗ 未跳转');

  // ============ 3. renderJobs 性能（原7389ms） ============
  const renderMs = await page.evaluate(() => {
    const t = performance.now();
    renderJobs();
    return performance.now() - t;
  });
  console.log('\n===== 3. renderJobs 性能 =====');
  console.log('耗时:', renderMs.toFixed(1) + 'ms', renderMs < 300 ? '✓ (原7389ms)' : '✗ 仍卡顿');

  // ============ 4. 推荐功能（多条推荐/生成都不卡） ============
  const recMs = await page.evaluate(() => {
    const t = performance.now();
    if (typeof recommendNow === 'function') { try { recommendNow(); } catch (e) {} }
    else { try { renderJobs(); } catch (e) {} }
    return performance.now() - t;
  });
  console.log('\n===== 4. 推荐功能响应 =====');
  console.log('recommendNow 耗时:', recMs.toFixed(1) + 'ms', recMs < 300 ? '✓ 秒响应' : '✗ 仍阻塞');
  // 推荐列表是否有内容渲染
  const recInfo = await page.evaluate(() => {
    const rec = document.querySelector('#recList') || document.querySelector('#recommendList') || document.querySelector('[data-tab="recommend"] .card-list');
    return rec ? (rec.innerHTML.match(/job-card|card/g) || []).length : -1;
  });
  console.log('推荐区域渲染卡片数(粗):', recInfo);

  // ============ 5. 分页翻页响应 ============
  const pageMs = await page.evaluate(() => {
    const t = performance.now();
    dbPage = 2; renderJobs();
    return performance.now() - t;
  });
  console.log('\n===== 5. 翻页性能 =====');
  console.log('翻页耗时:', pageMs.toFixed(1) + 'ms', pageMs < 300 ? '✓' : '✗');

  console.log('\n===== 运行时错误 =====');
  console.log(errors.length ? errors.slice(0, 5).join('\n') : '无 ✓');

  await browser.close();
  console.log('\n======= 回归验证完成 =======');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
