/* Terranova 设计页接入实测：元素完整性 / 菜单交互 / 控制台无报错 / 无滚动 / 无禁用库 */
const puppeteer = require('puppeteer-core');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8621/design/terranova/';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  /* ---------- 1280px 桌面视口 ---------- */
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // 1. 核心元素
  ok(await page.$eval('video#bg-video', v => v.getAttribute('src').includes('cloudfront.net')), '背景视频存在且 src 为指定云 URL');
  ok(await page.evaluate(() => {
    const v = document.getElementById('bg-video');
    return v.autoplay && v.muted && v.loop && v.playsInline && !v.crossOrigin;
  }), '视频 autoplay/muted/loop/playsinline 且未设 crossOrigin');
  ok(await page.$('#liquid-glass-refraction feTurbulence') !== null, 'SVG 液体玻璃滤镜 def 完整（含 feTurbulence）');
  ok(await page.$('[data-glass-card] #dup-image') !== null, '玻璃卡片 canvas 存在');
  ok(await page.$eval('#dup-image', c => !!c.getContext('2d')), 'canvas 2D 上下文可获取');
  ok((await page.$$eval('.menu__link', l => l.length)) === 5, '菜单含 5 个链接（About/Research/Projects/Journal/Contact）');
  ok(await page.$eval('#menu-open', b => b.getAttribute('aria-expanded') === 'false'), '初始 aria-expanded=false');

  // 2. 无滚动
  const scroll1 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  ok(scroll1.sw <= scroll1.cw && scroll1.sh <= scroll1.ch, `1280px 无滚动（scroll ${scroll1.sw}x${scroll1.sh} ≤ client ${scroll1.cw}x${scroll1.ch}）`);

  // 3. 视频帧同步循环已驱动（容器被定位到负偏移）
  ok(await page.evaluate(() => {
    const c = document.getElementById('dup-video-container');
    return parseFloat(c.style.left) <= 0 && parseFloat(c.style.top) <= 0 && c.style.width && c.style.height;
  }), 'dup 容器已按视口定位（负偏移对齐背景）');

  // 4. 菜单交互：打开 → 链接可见 → 关闭（X 按钮）→ Escape
  await page.click('#menu-open');
  await new Promise(r => setTimeout(r, 700));
  ok(await page.evaluate(() => document.getElementById('menu').classList.contains('is-open')), '点击汉堡 → 菜单 is-open');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'menu-close'), '打开后焦点移至关闭按钮');
  ok(await page.evaluate(() => document.getElementById('menu-open').getAttribute('aria-expanded') === 'true'), '打开后 aria-expanded=true');
  const linkVisible = await page.evaluate(() => {
    const l = document.querySelector('.menu__link');
    const s = getComputedStyle(l);
    return s.opacity === '1' && l.getBoundingClientRect().width > 0;
  });
  ok(linkVisible, '菜单链接已可见（透明度 1）');

  // 关闭：点链接
  await page.click('.menu__link:nth-child(1)');
  await new Promise(r => setTimeout(r, 600));
  ok(!(await page.evaluate(() => document.getElementById('menu').classList.contains('is-open'))), '点击链接 → 菜单关闭');

  // 再开 → backdrop 关闭
  await page.click('#menu-open');
  await new Promise(r => setTimeout(r, 600));
  await page.click('#menu-backdrop');
  await new Promise(r => setTimeout(r, 600));
  ok(!(await page.evaluate(() => document.getElementById('menu').classList.contains('is-open'))), '点击 backdrop → 菜单关闭');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'menu-open'), '关闭后焦点回到汉堡按钮');

  // 再开 → Escape 关闭
  await page.click('#menu-open');
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 600));
  ok(!(await page.evaluate(() => document.getElementById('menu').classList.contains('is-open'))), '按 Escape → 菜单关闭');

  // 5. 禁止库引用检查
  const src = await page.content();
  ok(!/Three\.js|WebGL|WebGPU|TSL|lil-gui|OrbitControls|three\.min/i.test(src), '页面源码零 Three.js/WebGL/WebGPU/TSL/lil-gui/OrbitControls 引用');

  // 6. 控制台无报错（视频外链加载失败类警告不算 JS 错误）
  ok(errors.length === 0, `控制台无 JS 报错（共 ${errors.length} 条）` + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));

  /* ---------- 375px 移动视口 ---------- */
  await page.setViewport({ width: 375, height: 667 });
  await new Promise(r => setTimeout(r, 800));
  const scroll2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  ok(scroll2.sw <= scroll2.cw && scroll2.sh <= scroll2.ch, `375px 无滚动（scroll ${scroll2.sw}x${scroll2.sh} ≤ client ${scroll2.cw}x${scroll2.ch}）`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.chamfer__glass')).backdropFilter !== 'none' || getComputedStyle(document.querySelector('.chamfer__glass')).webkitBackdropFilter !== 'none'), '375px 按钮毛玻璃层启用');
  await page.setViewport({ width: 800, height: 700 });
  await new Promise(r => setTimeout(r, 400));
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.rule--left')).display === 'flex'), '800px 竖线规则显示（≥768px）');

  await browser.close();
  console.log(`\n========== 设计页接入实测：${pass} 通过 / ${fail} 失败 ==========`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
