/**
 * 职聘通 JobHunter - 自动化投递引擎
 * -------------------------------------------------
 * 能力：
 *  1. 静态托管前端（index.html / data / resume / tools）
 *  2. WebSocket 实时推送投递日志
 *  3. puppeteer-core 驱动本机 Chrome/Edge，启发式填写招聘表单
 *  4. 验证码中继：自动截图回传前端，用户输入后继续
 *  5. 提交前人工确认：整页截图，用户确认后才点"提交"
 *  6. 投递状态持久化到 data/applications.json
 *
 * 运行：npm install && node server.js   →  http://localhost:8621
 */
'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 8621;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const APP_FILE = path.join(DATA_DIR, 'applications.json');
const PROFILE_DIR = path.join(ROOT, '.profile'); // 浏览器持久化登录态
const APPLY_HEADLESS = process.env.APPLY_HEADLESS === '1'; // 默认可见窗口
const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';
const SESSION_PROFILE_ROOT = path.join(ROOT, '.profiles');

/* ---------------- 浏览器检测 ---------------- */
// Edge 优先（用户偏好），Chrome 次之
const BROWSER_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  // Edge first
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // Chrome fallback
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  // Linux
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
  // macOS
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function detectBrowser() {
  for (const c of BROWSER_CANDIDATES) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return null;
}

function detectAllBrowsers() {
  const seen = new Set();
  const out = [];
  for (const c of BROWSER_CANDIDATES) {
    if (!c) continue;
    try {
      if (fs.existsSync(c) && !seen.has(c)) {
        seen.add(c);
        const name = c.includes('Edge') || c.includes('edge') ? 'Edge' : 'Chrome';
        out.push({ name, path: c });
      }
    } catch (_) {}
  }
  return out;
}

/* ---------------- 投递记录持久化 ---------------- */
function loadApplications() {
  try { return JSON.parse(fs.readFileSync(APP_FILE, 'utf8')); } catch (_) { return []; }
}
function saveApplications(list) {
  try { fs.writeFileSync(APP_FILE, JSON.stringify(list, null, 2), 'utf8'); } catch (_) {}
}

/* ---------------- 字段映射启发式规则 ---------------- */
const FIELD_RULES = [
  { key: 'name',     re: /姓名|name|username|realname|fullname/i,          type: 'text' },
  { key: 'gender',   re: /性别|gender|sex/i,                                type: 'select' },
  { key: 'birth',    re: /出生|生日|birth|birthday/i,                       type: 'date' },
  { key: 'hometown', re: /籍贯|生源地|户籍|hometown|native|domicile/i,      type: 'text' },
  { key: 'phone',    re: /手机|电话|mobile|phone|tel/i,                     type: 'text' },
  { key: 'email',    re: /邮箱|邮件|email|mail/i,                           type: 'text' },
  { key: 'wechat',   re: /微信|wechat|weixin/i,                             type: 'text' },
  { key: 'idcard',   re: /身份证|idcard|id_card|identity/i,                 type: 'text' },
  { key: 'school',   re: /学校|院校|大学|school|university|college/i,       type: 'text' },
  { key: 'major',    re: /专业|major/i,                                     type: 'text' },
  { key: 'degree',   re: /学历|degree|education/i,                          type: 'select' },
  { key: 'schoolStart', re: /入学|就读时间|开始时间|在校时间/i,              type: 'text' },
  { key: 'gradYear', re: /毕业(?!时间|日期)(年份|年度|届)?|graduat/i,      type: 'text' },
  { key: 'gradTime', re: /毕业时间|毕业日期/i,                              type: 'text' },
  { key: 'rank',     re: /排名|rank|绩点|gpa/i,                             type: 'text' },
  { key: 'city',     re: /现居|所在地|居住|city/i,                          type: 'text' },
  { key: 'preferCity', re: /期望城市|意向城市|工作城市|期望工作地|prefer/i, type: 'text' },
  { key: 'english',  re: /英语(水平|等级)?|cet|ielts|toefl/i,               type: 'text' },
  { key: 'otherLang',re: /其他外语|第二外语|小语种/i,                       type: 'text' },
  { key: 'certs',    re: /证书|资格证|certificate|license/i,                type: 'text' },
  { key: 'expSalary',re: /期望(月)?薪|薪资要求|期望薪酬|salary.?expect/i,   type: 'text' },
  { key: 'expAnnual',re: /期望年薪|年薪要求/i,                              type: 'text' },
  { key: 'acceptAdjust', re: /调剂|服从(分配|安排)|接受调配/i,              type: 'text' },
  { key: 'strengths',re: /擅长|优势领域|核心竞争力/i,                      type: 'text' },
  { key: 'intro',    re: /自我介绍|自我评价|个人简介|introduction|summary|cover/i, type: 'textarea' },
  { key: 'captcha',  re: /验证码|captcha|verify|vercode|checkcode/i,        type: 'captcha' },
  { key: 'agree',    re: /同意|授权|条款|协议|确认填写|声明/i,              type: 'checkbox' },
  { key: 'file',     re: /简历|附件|resume|cv|upload/i,                     type: 'file' },
];

function matchRule(fieldText) {
  const t = String(fieldText || '').toLowerCase();
  for (const r of FIELD_RULES) {
    if (r.re.test(t)) return r;
  }
  return null;
}

/* ---------------- 表单填写引擎 ---------------- */
class ApplyBot {
  constructor(task) {
    this.task = task;
    this.page = null;
    this.browser = null;
  }

  emit(evt) {
    const msg = JSON.stringify({ taskId: this.task.id, ...evt });
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN && ws.sessionId === this.task.ownerId) ws.send(msg);
    }
  }
  log(msg) { this.task.logs.push(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${msg}`); this.emit({ type: 'log', msg }); }
  setStatus(s) { this.task.status = s; this.emit({ type: 'status', status: s }); }

  async waitUser(key, timeoutMs = 300000) {
    // 挂起等待用户输入（验证码 / 确认），通过任务上的 pending 字段接收
    return new Promise((resolve, reject) => {
      this.task.pending = { key, resolve, reject };
      this.emit({ type: 'waiting', key });
      const timer = setTimeout(() => {
        if (this.task.pending) { this.task.pending = null; reject(new Error('等待用户操作超时')); }
      }, timeoutMs);
      this.task._pendingTimer = timer;
    });
  }

  resolvePending(key, payload) {
    if (this.task.pending && this.task.pending.key === key) {
      const { resolve, reject } = this.task.pending;
      this.task.pending = null;
      clearTimeout(this.task._pendingTimer);
      if (payload.error) reject(new Error(payload.error));
      else resolve(payload);
    }
  }

  // 收集所有可见表单元素的句柄 + 元信息（直接在页面内完成，避免重查错位）
  async collectFieldHandles() {
    const handles = await this.page.$$('input, select, textarea, input[type=checkbox], input[type=radio]');
    const out = [];
    for (const h of handles) {
      const meta = await h.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width <= 0 || r.height <= 0 || s.visibility === 'hidden' || s.display === 'none' || el.disabled || el.readOnly) return null;
        const type = el.type || '';
        if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return null;
        let p = el.closest('label, .el-form-item, .form-item, .form-group, li, tr, .field, .row');
        let txt = '';
        while (p && !txt) { txt = (p.innerText || '').replace(/\s+/g, ' ').slice(0, 40); p = p.parentElement; }
        return {
          tag: el.tagName.toLowerCase(),
          type,
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          aria: el.getAttribute('aria-label') || '',
          text: txt || el.placeholder || el.name || el.id || '',
        };
      });
      if (meta) out.push({ handle: h, meta });
    }
    return out;
  }

  async fillField(handle, meta, profile) {
    const probe = `${meta.name} ${meta.id} ${meta.placeholder} ${meta.aria} ${meta.text}`;
    const rule = matchRule(probe);
    if (!rule) return { filled: false, reason: '无法识别字段: ' + (meta.text || meta.name || meta.id || meta.placeholder).slice(0, 30) };
    if (rule.type === 'captcha') {
      return { filled: false, captcha: true };
    }
    if (rule.type === 'checkbox') {
      try { await handle.click({ timeout: 2000 }); } catch (_) {}
      return { filled: true };
    }
    if (rule.type === 'file') {
      return { filled: true, file: true };
    }
    let val = profile[rule.key];
    if (Array.isArray(val)) val = val.join('、');
    if (val === undefined || val === null || val === '' || val === '请填写手机号') return { filled: false, reason: '缺少画像字段: ' + rule.key };
    return { filled: true, value: String(val), rule };
  }

  async doFill(handle, meta, value) {
    if (meta.tag === 'select') {
      try { await handle.select(value); return true; } catch (_) {}
      // 选项文本匹配
      const opts = await handle.$$('option');
      for (const o of opts) {
        const txt = await o.evaluate((x) => (x.innerText || '').trim());
        if (txt && (txt.includes(value) || value.includes(txt))) {
          const v = await o.evaluate((x) => x.value || x.innerText);
          try { await handle.select(v); return true; } catch (_) { return false; }
        }
      }
      return false;
    }
    if (meta.tag === 'textarea' || meta.type === 'text' || meta.type === 'tel' || meta.type === 'email' || meta.type === 'number' || meta.type === 'date' || meta.type === 'password') {
      try {
        await handle.click({ timeout: 1500 });
        await handle.type(value, { delay: 0 });
        return true;
      } catch (_) {
        // 兜底：原生 value 注入
        try { await handle.evaluate((v, e) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, value); return true; } catch (_) { return false; }
      }
    }
    return false;
  }

  async applyTo(url, profile) {
    const browserPath = this.task.browserPath || detectBrowser();
    this.log(`🖥️ 启动浏览器驱动 ${browserPath}`);
    this.browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: APPLY_HEADLESS,
      // A public deployment must never share login cookies between visitors.
      userDataDir: this.task.profileDir || PROFILE_DIR,
      args: ['--no-first-run', '--disable-infobars', '--start-maximized'],
      defaultViewport: null,
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1440, height: 900 });

    this.log(`🌐 打开投递页面: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 登录墙检测：若出现明显的登录框，提示用户手动登录
    const loginDetected = await this.page.evaluate(() => {
      const t = (document.body.innerText || '').slice(0, 2000);
      const hasForm = !!document.querySelector('input[type=password], input[placeholder*="密码"], input[name*="password" i]');
      return hasForm && /登录|登 录|sign ?in|账号/i.test(t);
    });
    if (loginDetected) {
      this.log('🔐 检测到登录页 —— 请在浏览器窗口手动完成登录（一次登录后自动记住），登录后点击"继续投递"');
      this.setStatus('waiting-login');
      await this.waitUser('login');
      this.log('✅ 登录确认，继续投递流程');
    }

    // 主循环：填写 → 找提交按钮 → 点击下一步/提交
    let guard = 0;
    for (; guard < 12; guard++) {
      const fields = await this.collectFieldHandles();
      const needed = fields.filter(f => f.meta.tag !== 'check');
      this.log(`📝 检测到表单字段 ${needed.length} 个`);

      let captchaSeen = false;
      let unfilled = [];
      let fileHandle = null;

      for (const { handle, meta } of fields) {
        const res = await this.fillField(handle, meta, profile);
        if (res.captcha) { captchaSeen = true; continue; }
        if (res.file) { fileHandle = handle; continue; }
        if (res.filled) {
          const ok = await this.doFill(handle, meta, res.value);
          if (ok) this.log(`  ✔ ${(meta.text || meta.name || meta.id || meta.type).slice(0, 24)}: ${res.value}`);
          else unfilled.push({ meta, why: '填写失败' });
        } else {
          unfilled.push({ meta, why: res.reason });
        }
      }

      // 文件上传（简历附件）
      if (fileHandle) {
        const rp = profile.resumePdfPath;
        if (rp && fs.existsSync(rp)) {
          try { await fileHandle.uploadFile(rp); this.log(`  📎 上传简历: ${rp}`); } catch (e) { this.log(`  ⚠️ 简历上传失败: ${e.message}`); }
        } else {
          this.log(`  ⚠️ 发现简历上传框，请手动选择简历文件: ${profile.resumePdfPath || '(未配置简历路径)'}`);
        }
      }

      // 验证码处理：截图回传前端，用户输入后填入
      if (captchaSeen) {
        const shot = await this.page.screenshot({ encoding: 'base64', fullPage: false });
        this.log('🔢 检测到验证码，等待您输入…');
        this.setStatus('waiting-captcha');
        this.emit({ type: 'captcha', image: shot });
        const { code } = await this.waitUser('captcha');
        this.log(`🔢 收到验证码: ${code || '(空，手动填写)'}`);
        if (code) {
          const cf = await this.page.evaluateHandle(() => {
            const inputs = [...document.querySelectorAll('input')];
            return inputs.find(i => /验证码|captcha|verify|vercode|checkcode/i.test(`${i.name} ${i.id} ${i.placeholder}`)) || null;
          });
          if (cf) {
            try { await cf.type(String(code), { delay: 0 }); this.log('  ✔ 验证码已填写'); }
            catch (_) { this.log('  ⚠️ 验证码填写失败，请手动填写'); }
          } else { this.log('  ⚠️ 未找到验证码输入框，请手动填写'); }
        }
      }

      if (unfilled.length) {
        const detail = unfilled.slice(0, 5).map(u => `${(u.meta.text || u.meta.name || u.meta.id || u.meta.placeholder).slice(0, 20)}(${u.why})`).join('；');
        this.log(`⚠️ 有 ${unfilled.length} 个字段未能自动填写（${detail}…）请在浏览器中手动补齐，然后点击"继续投递"`);
        this.setStatus('waiting-manual');
        this.emit({ type: 'manual', fields: unfilled.map(u => u.meta) });
        await this.waitUser('continue');
        this.log('✅ 继续投递');
      }

      // 找按钮：优先"提交"，其次"下一步/继续"，避免误点导航
      const btnInfo = await this.page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, input[type=button], input[type=submit], a.btn, .btn, [role=button]')];
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const txt = (el) => (el.innerText || el.value || '').replace(/\s+/g, '');
        const submit = btns.find(b => vis(b) && /提交|投递|保存并投递|确认投递|立即申请|申请职位|提交申请|Submit/i.test(txt(b)));
        const next = btns.find(b => vis(b) && /下一步|继续|保存并下一步|下一页|Next/i.test(txt(b)));
        return { submit: submit ? txt(submit) : null, next: next ? txt(next) : null };
      });

      if (btnInfo.submit) {
        // 提交前人工确认：整页截图回传
        const shot = await this.page.screenshot({ encoding: 'base64', fullPage: true });
        this.log(`⏸️ 即将提交（${btnInfo.submit}），请核对表单内容后确认…`);
        this.setStatus('waiting-confirm');
        this.emit({ type: 'confirm', image: shot, button: btnInfo.submit });
        await this.waitUser('confirm');
        await this.page.evaluate((b) => {
          const btns = [...document.querySelectorAll('button, input[type=button], input[type=submit], a.btn, .btn, [role=button]')];
          const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const el = btns.find(x => vis(x) && ((x.innerText || x.value || '').replace(/\s+/g, '') === b));
          if (el) el.click();
        }, btnInfo.submit);
        this.log('🚀 已点击提交，等待系统返回…');
        await new Promise(r => setTimeout(r, 4000));
        this.setStatus('done');
        this.log('✅ 投递完成！可在"已投递"看板查看记录');
        return { ok: true, url };
      }

      if (btnInfo.next) {
        this.log(`⏭️ 点击"${btnInfo.next}"进入下一步`);
        await this.page.evaluate((b) => {
          const btns = [...document.querySelectorAll('button, input[type=button], input[type=submit], a.btn, .btn, [role=button]')];
          const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const el = btns.find(x => vis(x) && ((x.innerText || x.value || '').replace(/\s+/g, '') === b));
          if (el) el.click();
        }, btnInfo.next);
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }

      // 无按钮可点：可能是登录态/页面未就绪
      const bodyTxt = await this.page.evaluate(() => (document.body.innerText || '').slice(0, 300).replace(/\s+/g, ' '));
      this.log(`🤔 未找到"提交/下一步"按钮，当前页面片段: ${bodyTxt}`);
      this.log('💡 请在浏览器中手动完成投递，或返回重新选择投递页面');
      this.setStatus('waiting-manual');
      await this.waitUser('continue');
    }

    if (guard >= 12) throw new Error('页面步骤过多，可能陷入循环，已停止');
    return { ok: true, url };
  }

  async close() {
    try { if (this.page) await this.page.close(); } catch (_) {}
    try { if (this.browser) await this.browser.close(); } catch (_) {}
  }
}

/* ---------------- HTTP + WS ---------------- */
const app = express();
app.use(express.json({ limit: '20mb' }));

function sessionIdFromRequest(req) {
  const id = String(req.headers['x-jh-session'] || '').trim();
  // The client generates a 256-bit opaque identifier and keeps it in its own
  // browser storage. Invalid or absent identifiers stay in local-mode scope.
  return /^[a-f0-9]{32,128}$/i.test(id) ? id : 'local';
}

function profileDirFor(sessionId) {
  const safe = crypto.createHash('sha256').update(sessionId).digest('hex');
  return path.join(SESSION_PROFILE_ROOT, safe);
}

function ownsTask(req, id) {
  const task = tasks.get(id);
  return task && task.ownerId === sessionIdFromRequest(req) ? task : null;
}

const publicApplications = new Map();
function applicationsFor(sessionId) {
  return PUBLIC_MODE ? (publicApplications.get(sessionId) || []) : loadApplications();
}
function saveApplicationsFor(sessionId, list) {
  if (PUBLIC_MODE) publicApplications.set(sessionId, list.slice(0, 500));
  else saveApplications(list.slice(0, 500));
}

// Never expose locally stored resume or application data as static files.
app.use('/resume', (_req, res) => res.status(404).end());
app.use('/data/applications.json', (_req, res) => res.status(404).end());
app.use('/db/jobs_custom.json', (_req, res) => res.status(404).end());
app.use(express.static(ROOT));

app.get('/api/config', (_req, res) => res.json({ publicMode: PUBLIC_MODE, browserAvailable: !!detectBrowser(), browsers: detectAllBrowsers() }));

app.get('/api/browsers', (_req, res) => res.json({ browsers: detectAllBrowsers(), default: detectBrowser() }));

// Public visitors must never receive the server operator's resume. They start
// from the same redacted example, then keep their changes in localStorage.
app.get('/api/profile', (_req, res) => res.json(PUBLIC_MODE ? loadExampleProfile() : loadProfile()));

const tasks = new Map(); // taskId -> { id, url, company, title, status, logs[], pending, bot }

app.post('/api/apply/start', async (req, res) => {
  const { url, company, title, profile, browserPath } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: '需要合法的投递 URL' });
  const ownerId = sessionIdFromRequest(req);
  const id = 'A' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
  const task = { id, url, company: company || '', title: title || '', status: 'running', logs: [], createdAt: new Date().toISOString(), pending: null, ownerId, profileDir: PUBLIC_MODE ? profileDirFor(ownerId) : PROFILE_DIR, browserPath: browserPath || null };
  tasks.set(id, task);
  const p = profile || loadProfile();
  const bot = new ApplyBot(task);
  task.bot = bot;
  runApply(bot, id, url, p).catch((e) => {
    task.status = 'error';
    task.logs.push(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ❌ ${e.message}`);
    bot.emit({ type: 'error', msg: e.message });
    bot.close();
  });
  res.json({ id, status: 'running' });
});

app.post('/api/apply/respond', (req, res) => {
  const { id, key, payload } = req.body || {};
  const task = ownsTask(req, id);
  if (!task || !task.bot) return res.status(404).json({ error: '任务不存在' });
  task.bot.resolvePending(key, payload || {});
  res.json({ ok: true });
});

app.post('/api/apply/cancel', (req, res) => {
  const { id } = req.body || {};
  const task = ownsTask(req, id);
  if (task) {
    if (task.pending) { const { reject } = task.pending; task.pending = null; clearTimeout(task._pendingTimer); try { reject(new Error('用户取消')); } catch (_) {} }
    task.bot.close();
    task.status = 'cancelled';
    task.logs.push(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ⏹️ 已取消`);
    tasks.delete(id);
  }
  res.json({ ok: true });
});

app.get('/api/apply/tasks', (req, res) => {
  const ownerId = sessionIdFromRequest(req);
  res.json([...tasks.values()].filter(task => task.ownerId === ownerId).map(({ id, url, company, title, status, logs, createdAt }) => ({ id, url, company, title, status, logs: logs.slice(-50), createdAt })));
});

app.post('/api/applications', (req, res) => {
  const ownerId = sessionIdFromRequest(req);
  const list = applicationsFor(ownerId);
  list.unshift({ id: 'R' + Date.now().toString(36), ...req.body, createdAt: new Date().toISOString() });
  saveApplicationsFor(ownerId, list);
  res.json({ ok: true });
});
app.get('/api/applications', (req, res) => res.json(applicationsFor(sessionIdFromRequest(req))));
app.put('/api/applications/:id', (req, res) => {
  const ownerId = sessionIdFromRequest(req);
  const list = applicationsFor(ownerId);
  const i = list.findIndex(x => x.id === req.params.id);
  if (i >= 0) { list[i] = { ...list[i], ...req.body, id: list[i].id }; saveApplicationsFor(ownerId, list); res.json({ ok: true }); }
  else res.status(404).json({ error: 'not found' });
});
app.delete('/api/applications/:id', (req, res) => {
  const ownerId = sessionIdFromRequest(req);
  saveApplicationsFor(ownerId, applicationsFor(ownerId).filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

function loadProfile() {
  // 优先读取用户本地画像 resume/profile.json（已被 .gitignore 忽略、不会随仓库分发）
  // 不存在时回退到开源模板 resume/profile.example.json，保证 clone 后开箱即用
  const candidates = ['resume/profile.json', 'resume/profile.example.json'];
  for (const rel of candidates) {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (_) {}
  }
  return {};
}

function loadExampleProfile() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'resume/profile.example.json'), 'utf8')); }
  catch (_) { return {}; }
}

async function runApply(bot, id, url, profile) {
  try {
    const r = await bot.applyTo(url, profile);
    const list = applicationsFor(bot.task.ownerId);
    list.unshift({ id: 'R' + Date.now().toString(36), company: bot.task.company, title: bot.task.title, url, status: '已投递', createdAt: new Date().toISOString(), auto: true });
    saveApplicationsFor(bot.task.ownerId, list);
    return r;
  } finally {
    setTimeout(() => { if (tasks.has(id)) { tasks.get(id).bot.close(); tasks.delete(id); } }, 15000);
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const candidate = url.searchParams.get('sid') || '';
  ws.sessionId = /^[a-f0-9]{32,128}$/i.test(candidate) ? candidate : 'local';
  // Only expose this visitor's task metadata on this WebSocket.
  const brief = [...tasks.values()].filter(task => task.ownerId === ws.sessionId).map(({ id, company, title, status }) => ({ id, company, title, status }));
  ws.send(JSON.stringify({ type: 'snapshot', tasks: brief }));
});

// The application stores resume data and browser login state locally. Bind to
// loopback by default so a development machine does not expose it on a LAN.
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log('──────────────────────────────────────────────');
  console.log('  🎯 职聘通 JobHunter 已启动');
  console.log(`  ➜ 打开: http://localhost:${PORT}`);
  console.log(`  ➜ 浏览器驱动: ${detectBrowser() || '未检测到 Chrome/Edge！请安装 Chrome 后重试'}`);
  console.log(`  ➜ 窗口模式: ${APPLY_HEADLESS ? '无头(后台)' : '可见窗口(推荐)'}`);
  console.log(`  ➜ 服务模式: ${PUBLIC_MODE ? '公共访问（用户会话隔离）' : '本地单用户'}`);
  console.log('──────────────────────────────────────────────');
});
