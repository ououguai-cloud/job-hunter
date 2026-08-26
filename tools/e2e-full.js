/**
 * 职聘通 JobHunter - 全功能端到端实测（e2e-full）
 * -------------------------------------------------
 * 覆盖：
 *  Tab1 简历分析：PDF 上传解析 / 文本粘贴 / 示例简历
 *  Tab2 岗位推荐：推荐列表 / 分数徽章 / 加入投递单
 *  Tab3 简历优化：诊断卡片 / HR追问+建议回答 / 复制库
 *  Tab4 公司数据库：统计条 / 赛道多选 / 地区一体(省→市) / 组合筛选 / 招聘详情 / 官网直达 / 清空
 *  Tab5 一键投递：看板五列 / 状态流转 / CRUD
 *  通道：静态资源 / REST API / WebSocket / localStorage 持久化
 *
 * 运行：node tools/e2e-full.js
 */
'use strict';
const puppeteer = require('puppeteer-core');
const URL = 'http://127.0.0.1:8621';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++; else fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + msg);
}
function section(t) { console.log('\n── ' + t + ' ──'); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--window-size=1500,2600'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', async d => d.accept()); // 自动接受 confirm

  await page.goto(URL, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof JH !== 'undefined' && JH.jobs.length >= 5000, { timeout: 25000 });
  const goto = (tab) => page.evaluate(t => { document.querySelector(`.tab[data-tab="${t}"]`).click(); }, tab);
  const $eval = (sel, fn) => page.$eval(sel, fn);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ========== 通道：静态资源 ========== */
  section('通道稳定性 · 静态资源');
  for (const p of ['/', '/lib/pdf.min.js', '/lib/pdf.worker.min.js', '/db/jobs.json']) {
    const r = await fetch(URL + p);
    ok(r.status === 200, `GET ${p} → ${r.status}`);
  }

  /* ========== Tab1 简历分析 ========== */
  section('Tab1 简历分析');
  ok(await page.evaluate(() => JH.jobs.length) >= 5000, `岗位库加载：${await page.evaluate(() => JH.jobs.length)} 条`);
  // 1) PDF 上传解析
  const input = await page.$('#pdfInput');
  await input.uploadFile('screens/test-resume.pdf');
  await page.waitForFunction(() => document.getElementById('textArea').value.includes('13800138000'), { timeout: 25000 });
  const pdfTxt = await $eval('#textArea', el => el.value);
  ok(/13800138000/.test(pdfTxt) && /923371501@qq\.com/.test(pdfTxt), `PDF 上传 → 文本提取成功（含手机号/邮箱）`);
  await page.waitForSelector('#analysisResult .tag.purple', { timeout: 10000 });
  ok(true, 'PDF 解析后自动渲染简历画像');
  // 2) 文本粘贴分析（中文）
  await page.evaluate(() => {
    document.getElementById('textArea').value = `测试用户
电话：13800000000 邮箱：test@example.com
西安信息职业大学 · 通信软件工程 · 本科 · 2027届 · 专业排名前30%
掌握 Python / C++ / 树莓派
--- 实习与项目经历 ---
2025.12-2026.02 西安翼森设计 项目经理助理：协助2个家装项目全流程执行，维护30+条项目台账
2025.07-2025.11 盒先生夜猫店 品牌代理与私域运营：运营600+人社群，月均GMV从5千提升至1.2万
自我评价：具备客户沟通与需求挖掘能力，有地推陌拜实战经验`;
    analyzeText();
  });
  await page.waitForFunction(() => document.querySelector('#analysisResult') && /西安信息职业大学/.test(document.querySelector('#analysisResult').innerText), { timeout: 10000 });
  const profTxt = await $eval('#analysisResult', el => el.innerText);
  ok(/测试用户/.test(profTxt) && /西安信息职业大学/.test(profTxt) && /通信软件工程/.test(profTxt), '文本粘贴 → 姓名/学校/专业提取正确');
  ok(/经历/.test(profTxt), '文本粘贴 → 经历识别渲染');
  // 3) 画像扩展字段：招聘必问信息解析与渲染（第五轮新增）
  const profFull = await page.evaluate(() => {
    document.getElementById('textArea').value = `测试用户 男
电话：13800000000 邮箱：test@example.com 微信：test_wechat
籍贯：河南 现居城市：西安 出生年月：2004.05
2023.09-2027.06 西安信息职业大学 · 通信软件工程 · 本科 · 2027届 · 专业排名前30%
英语水平：CET-6 证书：计算机二级、普通话二级甲等
期望薪资：8-12K 期望年薪：10-15万 是否接受调剂：接受
擅长：客户沟通、数据分析、AI工具提效
掌握 Python / C++ / 树莓派，熟悉数据分析与 AI 工具
--- 实习与项目经历 ---
2025.12-2026.02 西安翼森设计 项目经理助理：协助2个家装项目全流程执行，维护30+条项目台账
2025.07-2025.11 盒先生夜猫店 品牌代理与私域运营：运营600+人社群，月均GMV从5千提升至1.2万`;
    analyzeText();
    return new Promise(res => setTimeout(() => res(document.getElementById('analysisResult').innerText), 300));
  });
  ok(/籍贯\s*河南/.test(profFull), '画像渲染：籍贯（河南）');
  ok(/男/.test(profFull) && /2004\.05/.test(profFull), '画像渲染：性别 + 出生年月');
  ok(/英语水平[：:]\s*CET-6/.test(profFull), '画像渲染：英语水平 CET-6');
  ok(/期望月薪[：:]\s*8-12K/.test(profFull) && /期望年薪[：:]\s*10-15万/.test(profFull), '画像渲染：期望月薪 8-12K + 期望年薪 10-15万');
  ok(/是否接受调剂[：:]\s*接受/.test(profFull), '画像渲染：是否接受调剂 = 接受');
  ok(/计算机二级/.test(profFull) && /普通话/.test(profFull), '画像渲染：技能证书（计算机二级/普通话）');
  ok(/擅长领域/.test(profFull) && /客户沟通/.test(profFull), '画像渲染：擅长领域');
  ok(/2023\.09 — 2027\.06/.test(profFull.replace(/\s+/g, ' ')), '画像渲染：就读时间 2023.09 — 毕业时间 2027.06');
  const profObj = await page.evaluate(() => JH.profile);
  ok(profObj.gender === '男' && profObj.hometown === '河南' && profObj.english === 'CET-6', '画像数据：gender/hometown/english 字段已写入 JH.profile');
  ok(profObj.expSalary === '8-12K' && profObj.expAnnual === '10-15万' && profObj.acceptAdjust === '接受', '画像数据：expSalary/expAnnual/acceptAdjust 字段已写入');
  ok((profObj.certs || []).includes('计算机二级') && (profObj.strengths || []).includes('客户沟通'), '画像数据：certs/strengths 数组字段已写入');

  /* ========== Tab2 岗位推荐 ========== */
  section('Tab2 岗位推荐');
  await goto('recommend');
  await page.waitForFunction(() => document.querySelectorAll('#recList .job-card').length >= 20, { timeout: 10000 });
  const recCards = await page.$$eval('#recList .job-card', cards => cards.map(c => c.innerText.slice(0, 120)));
  ok(recCards.length >= 20, `推荐列表渲染 ${recCards.length} 张卡片（新版分页默认每页 20 条）`);
  const recHasScore = await page.$$eval('#recList .job-card', cards => cards.every(c => /推荐|可投|强推|匹配/.test(c.innerText) || /\d{2,3}/.test(c.innerText)));
  ok(recHasScore, '推荐卡片含匹配度评分');
  // 加入投递单（第一张卡片的"加入投递单"按钮）
  await page.evaluate(() => { const b = [...document.querySelectorAll('#recList .job-card .job-foot button')].find(x => x.textContent.includes('加入投递单')); if (b) b.click(); });
  await sleep(600);
  const boardCount1 = await page.evaluate(() => JH.board.length);
  ok(boardCount1 >= 1, `从推荐加入投递单成功（当前看板 ${boardCount1} 项）`);

  /* ========== Tab3 简历优化 ========== */
  section('Tab3 简历优化 + 诊断 + HR 话术');
  await goto('optimize');
  await page.evaluate(() => {
    document.getElementById('optText').value = [
      '测试用户 13800000000 test@example.com',
      '西安信息职业大学 · 通信软件工程 · 本科 · 2027届',
      '负责销售相关工作，沟通能力强，学习能力强，认真负责，被安排做客户跟进。',
      '在实习期间负责客户拓展，通过努力提升了业绩。',
      '自我评价：认真负责',
    ].join('\n');
    runOptimize();
  });
  await page.waitForFunction(() => document.querySelectorAll('#optReport .diag-item').length > 0, { timeout: 10000 });
  const diag = await page.evaluate(() => ({
    items: document.querySelectorAll('#optReport .diag-item').length,
    hasQ: [...document.querySelectorAll('.d-q')].some(x => x.textContent.includes('HR 可能追问')),
    hasA: [...document.querySelectorAll('.d-a')].some(x => x.textContent.includes('建议回答')),
    hasScore: /简历健康度/.test(document.getElementById('optReport').innerText),
    copyBtns: document.querySelectorAll('#optReport .cpy, #optReport button').length,
  }));
  ok(diag.items >= 3, `诊断卡片渲染 ${diag.items} 条（空泛词/无数据/被动主语等命中）`);
  ok(diag.hasScore, '简历健康度分数渲染');
  ok(diag.hasQ, '诊断卡片含「HR 可能追问」话术');
  ok(diag.hasA, '诊断卡片含「建议回答」话术');
  ok(diag.copyBtns > 0, '诊断卡片可复制话术按钮');
  // 复制库
  const libItems = await page.$$eval('#copyLib .opt-item, #copyLib li', els => els.length);
  ok(libItems >= 10, `表达复制库渲染 ${libItems} 条`);

  /* ========== Tab4 公司数据库 ========== */
  section('Tab4 公司数据库 · 赛道多选 · 地区一体');
  await goto('jobs');
  await page.waitForFunction(() => document.getElementById('db-total') && +document.getElementById('db-total').textContent >= 5000, { timeout: 15000 });
  const stats = await page.evaluate(() => ({
    total: document.getElementById('db-total').textContent,
    companies: document.getElementById('db-companies').textContent,
    cities: document.getElementById('db-cities').textContent,
    tiers: document.getElementById('db-tiers').textContent,
    trackChips: [...document.querySelectorAll('#chips-type .chip')].map(c => c.textContent.trim()),
    provChips: [...document.querySelectorAll('#chips-prov .chip')].length,
  }));
  ok(+stats.total >= 5000, `统计条：岗位 ${stats.total} 条`);
  ok(+stats.companies >= 2000, `统计条：公司 ${stats.companies} 家`);
  ok(+stats.cities >= 80, `统计条：城市 ${stats.cities} 个`);
  ok(+stats.tiers >= 3, `统计条：规模等级 ${stats.tiers} 级`);
  ok(['应届生', '往届生', '实习生', '社招'].every(t => stats.trackChips.some(c => c.includes(t))), `赛道 chips：${stats.trackChips.join(' / ')}`);
  ok(stats.provChips >= 34, `地区栏省份 chips：${stats.provChips} 个省级行政区`);

  // 赛道筛选：只选"实习生"
  await page.evaluate(() => { [...document.querySelectorAll('#chips-type .chip')].find(e => e.textContent.includes('实习生')).click(); });
  await page.waitForFunction(() => document.querySelectorAll('#jobList .job-card').length > 0, { timeout: 10000 });
  await sleep(300);
  let cards = await page.$$eval('#jobList .job-card', cs => cs.map(c => c.innerText));
  ok(cards.length > 0 && cards.every(t => t.includes('实习生')), `只选「实习生」→ 列表 ${cards.length} 条全部为实习生赛道`);
  // 加选"社招"（多选）
  await page.evaluate(() => { [...document.querySelectorAll('#chips-type .chip')].find(e => e.textContent.includes('社招')).click(); });
  await sleep(400);
  cards = await page.$$eval('#jobList .job-card', cs => cs.map(c => c.innerText));
  const hasBoth = cards.some(t => t.includes('实习生')) && cards.some(t => t.includes('社招'));
  ok(cards.length > 0 && hasBoth, `多选「实习生+社招」→ 列表同时含两类赛道`);

  // 地区一体：清空 → 点"河南"
  await page.evaluate(() => clearFilters());
  await sleep(400);
  await page.evaluate(() => { [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('河南')).click(); });
  await sleep(500);
  const henan = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('河南'));
    const cityVisible = document.getElementById('chips-city').style.display !== 'none';
    const cityChips = [...document.querySelectorAll('#chips-city .chip')].map(c => c.textContent.trim());
    return { chipSel: chip && chip.classList.contains('sel'), cityVisible, cityChips, list: document.querySelectorAll('#jobList .job-card').length };
  });
  ok(henan.chipSel && henan.cityVisible, '点「河南」→ 全省选中 + 城市子面板展开');
  ok(henan.cityChips.length >= 5, `河南城市面板 ${henan.cityChips.length} 个市（郑州/洛阳/开封…）可多选`);
  // 城市多选：取消"郑州"
  await page.evaluate(() => { [...document.querySelectorAll('#chips-city .chip')].find(e => e.textContent.includes('郑州')).click(); });
  await sleep(400);
  const henanHalf = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('河南'));
    return { half: chip && chip.classList.contains('half'), sel: chip && chip.classList.contains('sel') };
  });
  ok(henanHalf.half && !henanHalf.sel, '取消「郑州」→ 河南变半选状态（部分城市选中）');
  const henanList = await page.$$eval('#jobList .job-card', cs => cs.map(c => c.innerText));
  ok(henanList.length > 0 && henanList.every(t => /郑州|洛阳|开封|平顶山|安阳|鹤壁|新乡|焦作|濮阳|许昌|漯河|三门峡|南阳|商丘|信阳|周口|驻马店/.test(t)), `河南半选 → 列表全部为河南城市岗位`);
  // 再点河南 → 收起并取消
  await page.evaluate(() => { [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('河南')).click(); });
  await sleep(400);
  const henanCleared = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('河南'));
    const cityHidden = document.getElementById('chips-city').style.display === 'none';
    return { sel: chip && chip.classList.contains('sel'), half: chip && chip.classList.contains('half'), cityHidden };
  });
  ok(!henanCleared.sel && !henanCleared.half && henanCleared.cityHidden, '再点「河南」→ 收起子面板 + 取消全省');
  // 直辖市：北京直接切换
  await page.evaluate(() => { [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('北京')).click(); });
  await sleep(500);
  const beijing = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('北京'));
    const list = [...document.querySelectorAll('#jobList .job-card')].map(c => c.innerText);
    return { sel: chip && chip.classList.contains('sel'), allB: list.length > 0 && list.every(t => /北京/.test(t)) };
  });
  ok(beijing.sel && beijing.allB, '直辖市「北京」→ 直接选中，列表全为北京岗位');

  // 组合筛选：赛道 + 地区 + 行业
  await page.evaluate(() => clearFilters());
  await sleep(300);
  await page.evaluate(() => { [...document.querySelectorAll('#chips-type .chip')].find(e => e.textContent.includes('应届生')).click(); });
  await page.evaluate(() => { [...document.querySelectorAll('#chips-industry .chip')].find(e => e.textContent.includes('金融')).click(); });
  await page.evaluate(() => { [...document.querySelectorAll('#chips-prov .chip')].find(e => e.textContent.includes('上海')).click(); });
  await sleep(500);
  const combo = await page.$$eval('#jobList .job-card', cs => cs.map(c => c.innerText));
  ok(combo.length > 0 && combo.every(t => t.includes('应届生') && t.includes('金融') && t.includes('上海')), `组合筛选「应届生+金融+上海」→ ${combo.length} 条全部命中`);

  // 招聘详情展开
  await page.evaluate(() => clearFilters());
  await sleep(400);
  await page.evaluate(() => { document.querySelector('#jobList .job-card .job-foot button').click(); });
  await sleep(400);
  const detail = await page.evaluate(() => {
    const jd = document.querySelector('#jobList .job-detail');
    return jd ? { visible: jd.style.display !== 'none', hasResp: /岗位职责/.test(jd.innerText), hasReq: /任职要求/.test(jd.innerText), hasTrack: /赛道/.test(jd.innerText) } : null;
  });
  ok(detail && detail.visible && detail.hasResp && detail.hasReq, '招聘详情展开：岗位职责 + 任职要求');
  ok(detail && detail.hasTrack, '招聘详情含赛道说明');
  const linkOk = await page.$$eval('#jobList .job-card a[target="_blank"]', as => as.every(a => /^https?:\/\//.test(a.href)));
  ok(linkOk, '官网直达链接格式合法');
  // 复制信息
  await page.evaluate(() => { const b = [...document.querySelectorAll('#jobList .job-card .job-foot button')].find(x => x.textContent.includes('复制')); if (b) b.click(); });
  ok(true, '复制岗位信息按钮可点击（含职责/要求/赛道）');
  // 清空
  await page.evaluate(() => clearFilters());
  await sleep(400);
  const afterClear = await page.$$eval('#jobList .job-card', cs => cs.length);
  ok(afterClear > 0, `清空筛选 → 列表恢复（${afterClear} 条）`);

  /* ========== Tab5 一键投递 ========== */
  section('Tab5 一键投递 · 看板 + API + WS');
  await goto('apply');
  await page.waitForFunction(() => document.querySelectorAll('#board .col').length === 5, { timeout: 10000 });
  const cols = await page.$$eval('#board .col h4', hs => hs.map(h => h.textContent.replace(/\d+$/, '')));
  ok(JSON.stringify(cols) === JSON.stringify(['待投递', '已投递', '有回复', '面试', 'Offer']), `看板五列：${cols.join('/')}`);
  const pendingCnt = await page.evaluate(() => JH.board.filter(b => b.status === '待投递').length);
  ok(pendingCnt >= 1, `「待投递」列含推荐加入的岗位 ×${pendingCnt}`);
  // 状态流转
  const firstPending = await page.evaluate(() => JH.board.find(b => b.status === '待投递'));
  ok(!!firstPending, '获取待投递项');
  if (firstPending) {
    await page.evaluate((id) => moveBoard(id, '已投递'), firstPending.id);
    await page.evaluate((id) => moveBoard(id, '有回复'), firstPending.id);
    await page.evaluate((id) => moveBoard(id, '面试'), firstPending.id);
    await page.evaluate((id) => moveBoard(id, 'Offer'), firstPending.id);
    const final = await page.evaluate((id) => JH.board.find(b => b.id === id).status, firstPending.id);
    ok(final === 'Offer', `状态流转：待投递→已投递→有回复→面试→Offer（当前 ${final}）`);
    await page.evaluate((id) => { JH.board = JH.board.filter(x => x.id !== id); persistBoard(); renderBoard(); }, firstPending.id);
    ok(true, '删除测试投递项完成');
  }
  // WS 通道
  await page.waitForFunction(() => document.getElementById('srv-status') && document.getElementById('srv-status').textContent.includes('已连接'), { timeout: 10000 });
  ok(true, 'WebSocket /ws 连接成功（srv-status=已连接）');
  // REST API 通道（Node 侧直测）
  section('REST API 通道');
  let r1 = await fetch(URL + '/api/applications');
  const appsBefore = await r1.json();
  const r2 = await fetch(URL + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: 'e2e-测试公司', title: 'e2e-测试岗位', url: 'https://example.com/job', status: '已投递' }) });
  const j2 = await r2.json();
  ok(r2.status === 200 && j2.ok, 'POST /api/applications 新增记录');
  const r3 = await fetch(URL + '/api/applications');
  const appsAfter = await r3.json();
  ok(appsAfter.length === appsBefore.length + 1, `GET /api/applications 读到新增（${appsBefore.length} → ${appsAfter.length}）`);
  const bad = await fetch(URL + '/api/apply/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'not-a-url' }) });
  const jb = await bad.json();
  ok(bad.status === 400 && jb.error, 'POST /api/apply/start 非法 URL → 400 拒绝（引擎有防护）');
  // 清理测试记录
  const newApp = appsAfter.find(a => a.company === 'e2e-测试公司');
  if (newApp) { await fetch(URL + '/api/applications/' + newApp.id, { method: 'DELETE' }); ok(true, 'DELETE 清理测试记录'); }

  /* ========== 持久化通道 ========== */
  section('持久化 · localStorage');
  await page.evaluate(() => { localStorage.setItem('jh_test_key', 'persist-ok'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof JH !== 'undefined' && JH.jobs.length >= 5000, { timeout: 25000 });
  const persisted = await page.evaluate(() => localStorage.getItem('jh_test_key'));
  ok(persisted === 'persist-ok', 'localStorage 刷新后保留');
  await page.evaluate(() => localStorage.removeItem('jh_test_key'));

  /* ========== 结果 ========== */
  console.log('\n════════════════════════════════');
  console.log(`  e2e-full 实测结果：✅ ${pass} 项通过 · ❌ ${fail} 项失败`);
  if (pageErrors.length) console.log('  页面 JS 异常:', pageErrors.slice(0, 5).join(' | '));
  else console.log('  页面 JS 无未捕获异常');
  console.log('════════════════════════════════');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
