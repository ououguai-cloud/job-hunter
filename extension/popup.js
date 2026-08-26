/* 职聘通·网申助手 — popup 逻辑 v2.6
 * 画像仅存 chrome.storage.local，不上传。
 * 填表引擎在 fill-engine.js（同时供 Node 单测），通过 chrome.scripting.executeScript 注入页面。
 * v2.6：画像字段扩展至 60+ 项（国籍/证件类型/出生地/学制/学习形式/学校层次/专业类别/
 *       录取批次/QQ/博客/LinkedIn/GitHub/期望行业/期望职能/接受出差/接受外派/科研经历/竞赛经历等）
 */

const LS_KEY = 'jh.profile.v2'; // 职聘通网站存放画像的 localStorage 键

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const statusEl = $('profile-status');
const fillBtn = $('btn-fill');
const syncBtn = $('btn-sync');
const editBtn = $('btn-edit');
const resultEl = $('fill-result');
const noneChk = $('opt-fill-none');

/* ---------- 工具 ---------- */
function fmtTime(ts) {
  if (!ts) return '从未';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function showResult(msg, kind) {
  resultEl.hidden = false;
  resultEl.className = 'result' + (kind ? ' ' + kind : '');
  resultEl.textContent = msg;
}
function getActiveTab() {
  return new Promise((res) => chrome.tabs.query({ active: true, currentWindow: true }, (t) => res(t && t[0])));
}
function countFields(p) {
  if (!p) return 0;
  let n = 0;
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) n++; }
    else n++;
  }
  return n;
}

/* ---------- 画像存取 ---------- */
function loadProfile() {
  return new Promise((res) => chrome.storage.local.get(['profile', 'syncedAt'], (d) => res(d)));
}
function saveProfile(profile) {
  return new Promise((res) => chrome.storage.local.set({ profile, syncedAt: Date.now() }, () => res()));
}
async function renderStatus() {
  const { profile, syncedAt } = await loadProfile();
  if (profile && countFields(profile) > 0) {
    const cnt = countFields(profile);
    statusEl.innerHTML = `当前画像：<span class="name">${profile.name || '未命名'}</span>
      <span class="ready">✓ 就绪</span>
      <span class="field-count">(${cnt}字段)</span>
      <br><span style="font-size:11px;color:var(--muted)">更新于 ${fmtTime(syncedAt)}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:var(--warn)">画像未填写</span><br>
      <span style="font-size:11px">点「📝 完善画像」开始填写，或从网站同步</span>`;
  }
}

/* ---------- 打开编辑器 ---------- */
function openEditor() {
  chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
}

/* ---------- 同步：注入读取 localStorage ---------- */
async function syncFromSite() {
  const tab = await getActiveTab();
  if (!tab || !/^https?:/.test(tab.url || '')) {
    showResult('请先打开职聘通网站页面再同步', 'warn');
    return false;
  }
  syncBtn.disabled = true;
  syncBtn.textContent = '同步中…';
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          const p = JSON.parse(raw);
          return p && p.name ? p : null;
        } catch (e) { return null; }
      },
      args: [LS_KEY],
    });
    if (!result) {
      showResult('当前页面未找到职聘通画像。请先在网站「简历画像」中填写，或点「完善画像」直接编辑。', 'warn');
      return false;
    } else {
      await saveProfile(result);
      await renderStatus();
      showResult(`✅ 已同步画像：${result.name}（${countFields(result)} 个字段）`);
      return true;
    }
  } catch (e) {
    showResult('同步失败：' + (e.message || e), 'err');
    return false;
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 从网站同步';
  }
}

/* ---------- 一键填写：注入填表函数 ---------- */
async function fillCurrentPage() {
  const { profile } = await loadProfile();
  if (!profile || countFields(profile) === 0) {
    showResult('画像未填写，无法填写。请先点「📝 完善画像」。', 'warn');
    return;
  }
  const tab = await getActiveTab();
  if (!tab || !/^https?:/.test(tab.url || '')) {
    showResult('请先打开一个企业投递页面', 'warn');
    return;
  }
  fillBtn.disabled = true;
  fillBtn.textContent = '填写中…';
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: FILL_FUNCTION,
      args: [profile, { fillNoneWhenEmpty: noneChk.checked }],
    });
    const r = result || {};
    const parts = [`✅ 已填 ${r.filled || 0} 项`];
    if (r.filledNone) parts.push(`其中填「无」 ${r.filledNone}`);
    if (r.skipped) parts.push(`缺数据 ${r.skipped}`);
    if (r.unmatched) parts.push(`未识别 ${r.unmatched}`);
    if (r.captcha) parts.push(`验证码 ${r.captcha}（需手动）`);
    if (r.file) parts.push(`简历上传 ${r.file}（需手动）`);
    let kind = '';
    if (r.filled === 0) { kind = 'warn'; parts.unshift('未填入任何字段——'); }
    showResult(parts.join(' · '), kind);
    if (r.unmatchedLabels && r.unmatchedLabels.length) {
      showResult(resultEl.textContent + `\n未识别字段：${r.unmatchedLabels.join('、')}`, kind);
    }
  } catch (e) {
    showResult('填写失败：' + (e.message || e) + '（该页面可能禁止脚本注入）', 'err');
  } finally {
    fillBtn.disabled = false;
    fillBtn.textContent = '⚡ 一键填写本页';
  }
}

/* ---------- 初始化 ---------- */
(async function init() {
  await renderStatus();
  fillBtn.addEventListener('click', fillCurrentPage);
  syncBtn.addEventListener('click', syncFromSite);
  editBtn.addEventListener('click', openEditor);

  // 「空缺项自动填无」开关：读取/持久化偏好（默认开）
  try {
    const pref = await new Promise((res) => chrome.storage.local.get(['fillNoneWhenEmpty'], res));
    noneChk.checked = pref.fillNoneWhenEmpty !== false;
  } catch (_) { /* 保持默认勾选 */ }
  noneChk.addEventListener('change', () => {
    chrome.storage.local.set({ fillNoneWhenEmpty: noneChk.checked });
  });

  // 打开 popup 时若当前页疑似职聘通站点，自动同步一次
  try {
    const tab = await getActiveTab();
    if (tab && /localhost|app\.workbuddy\.link|127\.0\.0\.1|职聘通|job-?hunter/i.test(tab.url || '')) {
      await syncFromSite();
    }
  } catch (_) {}

  // 画像变更时刷新状态
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.profile) {
      renderStatus();
    }
  });
})();
