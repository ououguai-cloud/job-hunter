/* 职聘通·网申助手 — popup 逻辑
 * 画像仅存 chrome.storage.local，不上传。
 * 填表引擎在 fill-engine.js（同时供 Node 单测），通过 chrome.scripting.executeScript 注入页面。
 * 这里引用全局 FILL_FUNCTION。
 */

const LS_KEY = 'jh.profile.v2'; // 职聘通网站存放画像的 localStorage 键

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const statusEl = $('profile-status');
const fillBtn = $('btn-fill');
const syncBtn = $('btn-sync');
const editBtn = $('btn-edit');
const resultEl = $('fill-result');
const editCard = $('edit-card');
const editArea = $('edit-area');

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

/* ---------- 画像存取 ---------- */
function loadProfile() {
  return new Promise((res) => chrome.storage.local.get(['profile', 'syncedAt'], (d) => res(d)));
}
function saveProfile(profile) {
  return new Promise((res) => chrome.storage.local.set({ profile, syncedAt: Date.now() }, () => res()));
}
async function renderStatus() {
  const { profile, syncedAt } = await loadProfile();
  if (profile && profile.name) {
    statusEl.innerHTML = `当前画像：<span class="name">${profile.name || '未命名'}</span> · <span class="ok">已同步 ${fmtTime(syncedAt)}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:var(--warn)">未同步</span> —— 请在职聘通网站打开本扩展并点「从网站同步」`;
  }
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
      showResult('当前页面未找到职聘通画像。请先在职聘通网站「简历画像」中填写信息。', 'warn');
      return false;
    } else {
      await saveProfile(result);
      await renderStatus();
      showResult(`✅ 已同步画像：${result.name}（${Object.keys(result).length} 个字段）`);
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
  if (!profile || !profile.name) {
    showResult('画像未同步，无法填写。请先点「从网站同步」。', 'warn');
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
      args: [profile],
    });
    const r = result || {};
    const parts = [`✅ 已填 ${r.filled || 0} 项`];
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

/* ---------- 画像编辑 ---------- */
async function openEditor() {
  const { profile } = await loadProfile();
  editArea.value = profile ? JSON.stringify(profile, null, 2) : '{}';
  editCard.hidden = false;
}
async function saveEdit() {
  try {
    const p = JSON.parse(editArea.value);
    await saveProfile(p);
    await renderStatus();
    showResult('画像已保存', '');
  } catch (e) {
    showResult('JSON 格式错误：' + (e.message || e), 'err');
  }
}

/* ---------- 初始化 ---------- */
(async function init() {
  await renderStatus();
  fillBtn.addEventListener('click', fillCurrentPage);
  syncBtn.addEventListener('click', syncFromSite);
  editBtn.addEventListener('click', openEditor);
  $('btn-save-edit').addEventListener('click', saveEdit);
  $('btn-close-edit').addEventListener('click', () => { editCard.hidden = true; });
  // 打开 popup 时若当前页疑似职聘通站点，自动同步一次
  try {
    const tab = await getActiveTab();
    if (tab && /localhost|app\.workbuddy\.link|127\.0\.0\.1|职聘通|job-?hunter/i.test(tab.url || '')) {
      await syncFromSite();
    }
  } catch (_) {}
})();
