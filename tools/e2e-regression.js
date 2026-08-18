/* ================================================================
   职聘通 JobHunter · 端到端回归测试
   覆盖：2056 岗位/822 公司/3 等级统计 · chips 多选组合筛选
        省市二级联动 · 招聘详情展开 · 简历优化诊断清单(HR追问+建议回答)
   运行：先 npm start（http://localhost:8621），再执行：
         node tools/e2e-regression.js
================================================================ */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8621';
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? '  ✅ ' : '  ❌ ') + msg); };
const readTiersInList = (page) => page.$$eval('#jobList .job-card', cards => {
  const set = new Set();
  cards.forEach(c => {
    if (c.querySelector('.tier-大厂')) set.add('大厂');
    else if (c.querySelector('.tier-中厂')) set.add('中厂');
    else if (c.querySelector('.tier-小厂')) set.add('小厂');
    else set.add('无');
  });
  return [...set];
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--window-size=1500,2600'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 2600 });
  page.on('pageerror', e => { fail++; console.log('  ❌ pageerror:', e.message); });

  console.log('▶ 访问站点');
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof JH !== 'undefined' && JH.jobs && JH.jobs.length >= 5000, { timeout: 25000 });

  /* ---------- 1. 数据量统计条 ---------- */
  console.log('▶ 1. 数据量统计条');
  await page.waitForFunction(() => +document.getElementById('db-total').textContent >= 5000, { timeout: 25000 });
  const stats = await page.evaluate(() => ({
    total: document.getElementById('db-total').textContent,
    companies: document.getElementById('db-companies').textContent,
    industries: document.getElementById('db-industries').textContent,
    cities: document.getElementById('db-cities').textContent,
    roles: document.getElementById('db-roles').textContent,
    tiers: document.getElementById('db-tiers').textContent,
  }));
  ok(+stats.total >= 5000, `岗位数 ${stats.total}（预期 ≥5000，2000+ 公司生成）`);
  ok(+stats.companies >= 2000, `公司数 ${stats.companies}（预期 ≥2000，第五轮扩容）`);
  ok(+stats.tiers === 3, `等级数 ${stats.tiers}（预期 3：大厂/中厂/小厂）`);
  ok(+stats.industries >= 15, `行业数 ${stats.industries}（预期 ≥15）`);
  ok(+stats.cities >= 80, `城市数 ${stats.cities}（预期 ≥80）`);

  /* ---------- 2. tier chips 多选筛选 ---------- */
  console.log('▶ 2. tier 多选筛选（大厂 + 中厂组合）');
  await page.click('.tab[data-tab="jobs"]');
  await page.waitForSelector('#chips-tier .chip');
  // 点"大厂"
  const tierChips = await page.$$eval('#chips-tier .chip', els => els.map(e => e.textContent.trim()));
  ok(tierChips.includes('大厂') && tierChips.includes('中厂') && tierChips.includes('小厂'), `tier chips 齐全：${tierChips.join(' / ')}`);
  await page.evaluate(() => { const el = [...document.querySelectorAll('#chips-tier .chip')].find(e => e.textContent.includes('大厂')); el.click(); });
  await page.waitForFunction(() => document.querySelectorAll('#jobList .job-card').length > 0);
  let tiersInList = await readTiersInList(page);
  ok(tiersInList.length === 1 && tiersInList[0] === '大厂', `只选"大厂"时列表全部为大厂（实际：${tiersInList.join(',')}）`);
  // 再组合"中厂"（多选）
  await page.evaluate(() => { const el = [...document.querySelectorAll('#chips-tier .chip')].find(e => e.textContent.includes('中厂')); el.click(); });
  await page.waitForFunction(() => [...document.querySelectorAll('#chips-tier .chip.sel')].length === 2);
  tiersInList = await readTiersInList(page);
  const tiersOk = tiersInList.length === 2 && !tiersInList.includes('小厂') && !tiersInList.includes('无');
  ok(tiersOk, `多选后列表为大厂+中厂（实际：${tiersInList.join(',')}）`);
  // 清空筛选
  await page.evaluate(() => clearFilters());
  await page.waitForFunction(() => document.querySelectorAll('#chips-tier .chip.sel').length === 0);

  /* ---------- 3. 省市二级联动（一体栏：点省→展开城市+全省选中） ---------- */
  console.log('▶ 3. 省市二级联动（点"广东"→ 展开城市面板 + 全省全选）');
  await page.waitForSelector('#chips-prov .chip');
  await page.evaluate(() => { const el = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('广东')); el.click(); });
  await page.waitForFunction(() => document.querySelector('#chips-city') && document.querySelector('#chips-city').style.display !== 'none');
  const provInfo = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('广东'));
    const txt = el ? el.textContent : '';
    const cities = [...document.querySelectorAll('#chips-city .chip')].map(e => e.textContent.replace(' ✕',''));
    return { txt, gdCities: cities.filter(c => ['深圳','广州','东莞','佛山','珠海','中山','惠州','江门','汕头','湛江','肇庆','清远','韶关','梅州','潮州','揭阳','河源','汕尾','阳江','茂名','云浮','顺德'].includes(c)) };
  });
  ok(provInfo.txt.includes('广东'), `省份 chips 含"广东"（${provInfo.txt.trim().slice(0,20)}）`);
  ok(provInfo.gdCities.length >= 3, `点"广东"后城市面板含广东城市 ≥3 个（${provInfo.gdCities.length}）`);
  const gdSel = await page.$$eval('#chips-city .chip.sel', els => els.length);
  ok(gdSel >= 3, `点"广东"→ 全省城市自动全选（${gdSel} 个城市选中）`);
  await page.waitForFunction(() => document.querySelectorAll('#jobList .job-card').length > 0);
  const gdCards = await page.$$eval('#jobList .job-card', cards => cards.length);
  const gdJobs = await page.$$eval('#jobList .job-card', cards => cards.map(c => (c.querySelector('.job-meta') || {}).textContent || ''));
  const allGd = gdCards > 0 && gdJobs.every(t => /广东|深圳|广州|东莞|佛山|珠海|中山|惠州|汕头|湛江|江门|肇庆|顺德/.test(t));
  ok(allGd, `筛选后列表全部为广东城市岗位（${gdCards} 张卡片）`);
  await page.evaluate(() => clearFilters());
  await page.waitForFunction(() => document.querySelectorAll('#chips-prov .chip.sel').length === 0 && document.querySelectorAll('#chips-city .chip.sel').length === 0);

  /* ---------- 4. 行业多选组合 ---------- */
  console.log('▶ 4. 行业多选（互联网 + 金融）');
  const indChips = await page.$$eval('#chips-industry .chip', els => els.map(e => e.textContent.trim()));
  const hasHlw = indChips.some(t => t.includes('互联网')), hasJR = indChips.some(t => t.includes('金融'));
  ok(hasHlw && hasJR, `行业 chips 含互联网/金融（共 ${indChips.length} 个行业）`);
  await page.evaluate(() => {
    [...document.querySelectorAll('#chips-industry .chip')].filter(e => e.textContent.includes('互联网') || e.textContent.includes('金融')).forEach(e => e.click());
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#chips-industry .chip.sel')].length === 2);
  const indInList = await page.$$eval('#jobList .job-card', cards => [...new Set(cards.map(c => c.querySelector('.job-meta').textContent.match(/互联网|金融/g) ? (c.querySelector('.job-meta').textContent.includes('互联网') ? '互联网' : '金融') : '无'))].sort());
  ok(indInList.length <= 2 && !indInList.includes('无'), `组合筛选后列表仅含所选行业（实际：${indInList.join(',')}）`);
  await page.evaluate(() => clearFilters());

  /* ---------- 5. 招聘详情展开 ---------- */
  console.log('▶ 5. 岗位卡片"招聘详情"展开');
  await page.waitForSelector('#jobList .job-card');
  const hasDetailBtn = await page.$('#jobList .job-card .job-foot button');
  ok(!!hasDetailBtn, '卡片存在"招聘详情"按钮');
  await page.evaluate(() => { document.querySelector('#jobList .job-card .job-foot button').click(); });
  await page.waitForFunction(() => { const d = document.querySelector('#jobList .job-card .job-detail'); return d && d.style.display !== 'none'; });
  const detail = await page.evaluate(() => {
    const d = document.querySelector('#jobList .job-card .job-detail');
    return { text: d.textContent, hasResp: d.textContent.includes('岗位职责'), hasReq: d.textContent.includes('任职要求'), hasCo: d.textContent.includes('公司信息'), hasCh: d.textContent.includes('投递渠道') };
  });
  ok(detail.hasResp && detail.hasReq && detail.hasCo && detail.hasCh, '详情含 岗位职责/任职要求/公司信息/投递渠道');
  ok(detail.text.includes('·'), '职责/要求条目以列表呈现');
  // 收起
  await page.evaluate(() => { document.querySelector('#jobList .job-card .job-foot button').click(); });
  await page.waitForFunction(() => { const d = document.querySelector('#jobList .job-card .job-detail'); return d && d.style.display === 'none'; });
  ok(true, '再次点击可收起详情');

  /* ---------- 6. 简历优化诊断清单 ---------- */
  console.log('▶ 6. 简历优化诊断清单（信息缺漏 + 正文问题 + HR 追问）');
  await page.click('.tab[data-tab="optimize"]');
  await page.waitForSelector('#optText');
  await page.evaluate(() => {
    document.getElementById('optText').value = [
      '测试用户　13800000000　test@example.com',
      '西安信息职业大学 · 通信软件工程 · 本科 · 2027届',
      '负责销售相关工作，沟通能力强，学习能力强，认真负责，被安排做客户跟进。',
      '在实习期间负责客户拓展，通过努力提升了业绩。',
      '自我评价：认真负责',
      '这是一句用于测试超长句检测的句子，包含很多很多很多很多很多很多很多很多很多很多很多很多字数超过六十个字符的废话内容。',
    ].join('\n');
    runOptimize();
  });
  await page.waitForSelector('#optReport .diag-item');
  const diag = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#optReport .diag-item')];
    return {
      n: cards.length,
      hasQ: cards.some(c => [...c.querySelectorAll('.d-q')].some(q => q.textContent.includes('HR 可能追问'))),
      hasA: cards.some(c => c.querySelector('.d-a') && c.querySelector('.d-a').textContent.includes('建议回答')),
      hasCopy: cards.some(c => c.querySelector('.cpy') && c.querySelector('.cpy').textContent.includes('复制回答')),
      hasDiagTitle: document.querySelector('#optReport').textContent.includes('个人信息诊断'),
      hasBodyTitle: document.querySelector('#optReport').textContent.includes('简历正文问题'),
      hasPhoneIssue: document.querySelector('#optReport').textContent.includes('手机号'),
      health: document.querySelector('#optReport').textContent.match(/简历健康度 (\d+)/)?.[1],
    };
  });
  ok(diag.n >= 3, `诊断卡片渲染 ${diag.n} 张（预期 ≥3）`);
  ok(diag.hasDiagTitle && diag.hasBodyTitle, '报告含"个人信息诊断"与"简历正文问题"两个区块');
  ok(diag.hasQ && diag.hasA, '卡片含"HR 可能追问"+"建议回答"');
  ok(diag.hasCopy, '卡片含"复制回答"按钮');
  ok(diag.hasPhoneIssue, '检测到手机号占位/缺失问题');
  ok(!!diag.health && +diag.health <= 96, `健康度评分生成（${diag.health}）`);

  /* ---------- 7. 完整简历文本时的诊断收敛 ---------- */
  // v2 行为变更：runOptimize() 基于"当前编辑区文本"实时提取画像（extractProfile），
  // 而非 Tab1 的 JH.profile —— 这里用一份字段齐全的简历文本验证诊断项收敛
  console.log('▶ 7. 编辑区填入完整简历后诊断项收敛');
  await page.evaluate(() => {
    const fullResume = [
      '姓名：李明华  性别：男  出生年月：2003.05',
      '籍贯：陕西西安  现居城市：西安  电话：13800001234  邮箱：liminghua2026@163.com  微信：lmh2026wx',
      '西安外国语大学  专业：市场营销  本科  2026届  2022.09-2026.06',
      '英语水平：CET-6  其他外语：日语N2  技能证书：初级会计、普通话二甲',
      '求职意向：销售管培生  期望薪资：8000-10000元/月  意向城市：西安  接受调剂：是',
      '个人评价：具备客户沟通与需求挖掘能力，地推陌拜累计转化客户326人，私域社群运营3个月复购率提升45%。'
    ].join('\n');
    $('optText').value = fullResume;
    runOptimize();
  });
  const diag2 = await page.evaluate(() => ({
    n: document.querySelectorAll('#optReport .diag-item').length,
  }));
  // 字段齐全的简历文本应显著减少个人信息缺漏诊断（正文问题卡片仍可能存在）
  ok(diag2.n < diag.n, `完整简历文本后诊断项收敛（diag 卡片 ${diag.n} → ${diag2.n} 张）`);

  console.log(`\n========== 回归结果：${pass} 通过 / ${fail} 失败 ==========`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E 异常:', e.message); process.exit(1); });
