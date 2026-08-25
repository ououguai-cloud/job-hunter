/* 职聘通·网申助手 — 填表引擎
 * 自包含、无 chrome 依赖：既可由 popup 通过 chrome.scripting.executeScript 注入页面执行，
 * 也可在 Node + jsdom 环境做单元测试。
 * 注入到页面时，函数体内的 document / window / Event / HTMLInputElement 均指页面上下文。
 */
function FILL_FUNCTION(profile) {
  const RULES = [
    { key: 'name', re: /姓名|真实姓名|fullname|realname|^name$|username/i, type: 'text' },
    { key: 'gender', re: /性别|gender|sex/i, type: 'radio' },
    { key: 'birth', re: /出生|生日|birth|birthday/i, type: 'text' },
    { key: 'age', re: /年龄|^age$/i, type: 'text' },
    { key: 'hometown', re: /籍贯|生源地|户籍|户口|native|domicile/i, type: 'text' },
    { key: 'nation', re: /民族|nation|ethnic/i, type: 'text' },
    { key: 'politics', re: /政治面貌|political/i, type: 'select' },
    { key: 'idcard', re: /身份证|idcard|id_card|identity/i, type: 'text' },
    { key: 'phone', re: /手机|电话|联系方式|mobile|phone|tel/i, type: 'text' },
    { key: 'email', re: /邮箱|邮件|email|e-mail|mail/i, type: 'text' },
    { key: 'wechat', re: /微信|wechat|weixin/i, type: 'text' },
    { key: 'address', re: /通讯地址|联系地址|住址|现住址|常驻地址|address/i, type: 'text' },
    { key: 'postcode', re: /邮编|邮政编码|zip|postcode/i, type: 'text' },
    { key: 'emergencyContact', re: /紧急联系人|联系人姓名/i, type: 'text' },
    { key: 'emergencyPhone', re: /紧急联系电话|紧急电话|紧急联系方式/i, type: 'text' },
    { key: 'school', re: /学校|院校|毕业院校|大学|school|university|college/i, type: 'text' },
    { key: 'major', re: /专业|major|specialty/i, type: 'text' },
    { key: 'degree', re: /学历|学位|degree|education/i, type: 'select' },
    { key: 'schoolStart', re: /入学|就读时间|在校开始|开始时间/i, type: 'text' },
    { key: 'gradYear', re: /毕业(?!时间|日期)(年份|年度|届)?|graduat/i, type: 'text' },
    { key: 'gradTime', re: /毕业时间|毕业日期/i, type: 'text' },
    { key: 'rank', re: /排名|绩点|gpa|学业成绩/i, type: 'text' },
    { key: 'city', re: /现居|现居地|所在地|居住地|常居|\bcity\b/i, type: 'text' },
    { key: 'preferCity', re: /期望城市|意向城市|工作城市|期望工作地|期望地点|意向地点|prefer/i, type: 'text' },
    { key: 'target', re: /求职意向|期望职位|意向岗位|应聘岗位|目标岗位|target|intend/i, type: 'text' },
    { key: 'english', re: /英语(水平|等级|能力)?|cet|ielts|toefl|四六级/i, type: 'text' },
    { key: 'otherLang', re: /其他外语|第二外语|小语种/i, type: 'text' },
    { key: 'certs', re: /证书|资格证|职业资格|certificate|license/i, type: 'text' },
    { key: 'skills', re: /技能|特长|专长|skills|skill/i, type: 'text' },
    { key: 'expSalary', re: /期望(月)?薪|薪资要求|期望薪酬|月薪要求|salary/i, type: 'text' },
    { key: 'expAnnual', re: /期望年薪|年薪要求|年薪/i, type: 'text' },
    { key: 'acceptAdjust', re: /调剂|服从(分配|安排)|接受调配|服从调剂/i, type: 'select' },
    { key: 'strengths', re: /擅长|优势|优势领域|核心竞争力|个人优势/i, type: 'text' },
    { key: 'selfIntro', re: /自我介绍|自我评价|个人简介|个人陈述|introduction|summary|cover/i, type: 'textarea' },
    { key: 'experiences', re: /实习经历|工作经历|实践经历|经历|experience/i, type: 'textarea' },
    { key: 'campus', re: /校园经历|学生工作|社团经历|校园/i, type: 'textarea' },
    { key: 'captcha', re: /验证码|captcha|verify|vercode|checkcode|图形码/i, type: 'captcha' },
    { key: 'agree', re: /同意|授权|条款|协议|确认填写|声明|承诺|已阅读/i, type: 'checkbox' },
    { key: 'file', re: /简历|附件|上传|resume|cv|upload/i, type: 'file' },
  ];

  function matchRule(text) {
    const t = String(text || '').toLowerCase();
    for (const r of RULES) if (r.re.test(t)) return r;
    return null;
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width <= 0 || r.height <= 0 || s.visibility === 'hidden' || s.display === 'none' || el.disabled || el.readOnly) return false;
    return true;
  }

  function probeText(el) {
    let p = el.closest('label,.el-form-item,.form-item,.form-group,.ant-form-item,.van-field,.field,.row,li,tr,td,dd');
    let txt = '';
    let guard = 0;
    while (p && !txt && guard++ < 5) {
      txt = (p.innerText || p.textContent || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim().slice(0, 60);
      p = p.parentElement;
    }
    return [el.name, el.id, el.placeholder, el.getAttribute('aria-label') || '', txt].join(' ');
  }

  function nativeSetter(el) {
    if (el.tagName === 'TEXTAREA') return Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    return Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  }

  function setVal(el, val) {
    const setter = nativeSetter(el);
    if (setter) setter.call(el, val); else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setSelect(el, val) {
    const opts = Array.from(el.options || []);
    let m = opts.find(o => o.text.trim() === String(val).trim())
      || opts.find(o => o.value === String(val))
      || opts.find(o => o.text.includes(val) || String(val).includes(o.text.trim()));
    if (m) { el.value = m.value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    return false;
  }

  function setRadio(el, val) {
    const group = el.name ? document.getElementsByName(el.name) : [el];
    const target = Array.from(group).find(r => {
      const lab = r.closest('label');
      const t = lab ? (lab.innerText || '') : '';
      return t.includes(val) || r.value === String(val) || String(val).includes(r.value);
    });
    if (target) { target.click(); return true; }
    return false;
  }

  const els = Array.from(document.querySelectorAll('input,select,textarea'));
  let filled = 0, skipped = 0, unmatched = 0, captcha = 0, file = 0;
  const unmatchedLabels = [];
  const seen = new Set();

  for (const el of els) {
    const type = (el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (!visible(el)) continue;
    if (seen.has(el)) continue;
    seen.add(el);

    const probe = probeText(el);
    const rule = matchRule(probe);
    if (!rule) {
      unmatched++;
      if (unmatchedLabels.length < 6) unmatchedLabels.push((probe.split(' ').pop() || el.placeholder || el.name || el.id || '').slice(0, 18));
      continue;
    }
    if (rule.type === 'captcha') { captcha++; continue; }
    if (rule.type === 'file') { file++; continue; }
    if (rule.type === 'checkbox') {
      try { if (!el.checked) el.click(); } catch (_) {}
      filled++; continue;
    }

    let val = profile[rule.key];
    if (Array.isArray(val)) {
      if (val.length && typeof val[0] === 'object' && val[0]) {
        // 经历类对象数组（实习/工作/校园经历）→ 格式化为可读文本
        val = val.map(e => [e.org, e.role].filter(Boolean).join(' ')
          + (e.time ? `（${e.time}）` : '')
          + (e.desc ? `：${e.desc}` : '')).join('\n');
      } else {
        val = val.join('、');
      }
    }
    if (val === undefined || val === null || val === '' || val === '请填写手机号') { skipped++; continue; }
    val = String(val);

    try {
      if (rule.type === 'radio') {
        if (setRadio(el, val)) { filled++; seen.add(el); }
      } else if (el.tagName === 'SELECT' || rule.type === 'select') {
        setSelect(el, val) ? filled++ : skipped++;
      } else if (el.tagName === 'TEXTAREA' || rule.type === 'textarea') {
        setVal(el, val); filled++;
      } else {
        setVal(el, val); filled++;
      }
    } catch (_) { skipped++; }
  }

  return { filled, skipped, unmatched, captcha, file, unmatchedLabels };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { FILL_FUNCTION, RULES: null };
if (typeof window !== 'undefined') window.FILL_FUNCTION = FILL_FUNCTION;
